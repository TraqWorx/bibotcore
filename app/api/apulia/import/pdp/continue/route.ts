import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { processPdpChunk, finalizePdp, type CompactContact, type ChunkCounters } from '@/lib/apulia/pdp-chunked'
import { triggerPdpContinue } from '../_continue-trigger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const CHUNK_SIZE = 400
const TIME_BUDGET_MS = 240_000 // 4 min — leave ~60s headroom under Vercel's 300s

interface PayloadMeta {
  colFieldMap: Record<string, string>
  byPodInit: Record<string, CompactContact>
  createdInRun: Record<string, CompactContact>
}

interface Payload {
  rows: Record<string, string>[]
}

/**
 * Process the next slice of an in-progress PDP import. Self-triggers
 * for the next chunk if more rows remain; finalizes (auto-creates
 * admins + recomputes commissions) on the last chunk.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-internal-secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const sb = createAdminClient()
  const { data: row } = await sb
    .from('apulia_imports')
    .select('id, status, progress_done, progress_total, payload, payload_meta, created, updated, untagged, unmatched, skipped')
    .eq('id', id)
    .maybeSingle()
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (row.status !== 'running') return NextResponse.json({ skipped: true, status: row.status })

  const payload = row.payload as Payload | null
  const meta = row.payload_meta as PayloadMeta | null
  if (!payload?.rows || !meta) {
    // New-style DB-first PDP imports run to completion synchronously and
    // never persist a payload. If the dispatcher hits this row before the
    // POST finishes, just no-op; the POST handler will mark it completed.
    return NextResponse.json({ skipped: true, reason: 'no payload (db-first import)' })
  }

  const total = payload.rows.length
  if ((row.progress_done ?? 0) >= total) {
    return await runFinalize(sb, id, payload.rows, meta.colFieldMap, row)
  }

  const startedAt = Date.now()
  let done = row.progress_done ?? 0
  let counters: ChunkCounters = {
    created: row.created ?? 0,
    updated: row.updated ?? 0,
    untagged: row.untagged ?? 0,
    unmatched: row.unmatched ?? 0,
    skipped: row.skipped ?? 0,
  }
  let createdInRun = { ...meta.createdInRun }

  await sb.from('apulia_imports').update({ last_continue_at: new Date().toISOString() }).eq('id', id)

  // Process as many chunks as fit in our time budget.
  let rateLimited = false
  while (done < total && Date.now() - startedAt < TIME_BUDGET_MS) {
    const end = Math.min(done + CHUNK_SIZE, total)
    const slice = payload.rows.slice(done, end)
    const byPodView = { ...meta.byPodInit, ...createdInRun }
    const out = await processPdpChunk(slice, meta.colFieldMap, byPodView, counters)
    counters = out.counters
    createdInRun = { ...createdInRun, ...out.newCreated }
    if (out.rateLimited) {
      // Save partial progress for whatever did succeed before the block.
      done += out.processedCount ?? 0
      rateLimited = true
      await sb.from('apulia_imports').update({
        progress_done: done,
        created: counters.created,
        updated: counters.updated,
        untagged: counters.untagged,
        unmatched: counters.unmatched,
        skipped: counters.skipped,
        payload_meta: { ...meta, createdInRun },
        last_progress_at: new Date().toISOString(),
        // Push last_continue_at into the future so dispatcher waits ~90s.
        last_continue_at: new Date(Date.now() + 90_000).toISOString(),
      }).eq('id', id)
      break
    }
    done = end
    await sb.from('apulia_imports').update({
      progress_done: done,
      created: counters.created,
      updated: counters.updated,
      untagged: counters.untagged,
      unmatched: counters.unmatched,
      skipped: counters.skipped,
      payload_meta: { ...meta, createdInRun },
      last_progress_at: new Date().toISOString(),
    }).eq('id', id)
  }

  if (rateLimited) {
    return NextResponse.json({ done, total, paused: 'rate-limited' })
  }

  if (done < total) {
    await triggerPdpContinue(id)
    return NextResponse.json({ done, total, more: true })
  }

  return await runFinalize(sb, id, payload.rows, meta.colFieldMap, { ...row, ...counters, progress_done: done })
}

async function runFinalize(
  sb: ReturnType<typeof createAdminClient>,
  id: string,
  rows: Record<string, string>[],
  colFieldMap: Record<string, string>,
  state: { created?: number | null; updated?: number | null; untagged?: number | null; unmatched?: number | null; skipped?: number | null; progress_done?: number | null },
): Promise<NextResponse> {
  try {
    const { adminCreates, recomputed } = await finalizePdp(rows, colFieldMap)
    await sb.from('apulia_imports').update({
      status: 'completed',
      finished_at: new Date().toISOString(),
      last_progress_at: new Date().toISOString(),
      payload: null, // free up the heavy JSON now that we're done
    }).eq('id', id)
    return NextResponse.json({ done: true, finalized: true, adminCreates, recomputed, state })
  } catch (err) {
    await sb.from('apulia_imports').update({
      status: 'failed',
      finished_at: new Date().toISOString(),
      error_msg: err instanceof Error ? err.message : 'finalize failed',
    }).eq('id', id)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'finalize failed' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return POST(req)
}
