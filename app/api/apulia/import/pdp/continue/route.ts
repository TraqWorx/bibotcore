import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { processPdpChunk, finalizePdp, type CompactContact, type ChunkCounters } from '@/lib/apulia/pdp-chunked'
import { triggerPdpContinue } from '../_continue-trigger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const CHUNK_SIZE = 400

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
    await sb.from('apulia_imports').update({ status: 'failed', finished_at: new Date().toISOString() }).eq('id', id)
    return NextResponse.json({ error: 'Missing payload' }, { status: 500 })
  }

  const total = payload.rows.length
  const start = row.progress_done ?? 0
  const end = Math.min(start + CHUNK_SIZE, total)
  if (start >= total) {
    return await runFinalize(sb, id, payload.rows, meta.colFieldMap, row)
  }

  const slice = payload.rows.slice(start, end)
  const byPodView = { ...meta.byPodInit, ...meta.createdInRun }
  const prev: ChunkCounters = {
    created: row.created ?? 0,
    updated: row.updated ?? 0,
    untagged: row.untagged ?? 0,
    unmatched: row.unmatched ?? 0,
    skipped: row.skipped ?? 0,
  }

  await sb.from('apulia_imports').update({ last_continue_at: new Date().toISOString() }).eq('id', id)

  const out = await processPdpChunk(slice, meta.colFieldMap, byPodView, prev)
  const newCreatedInRun = { ...meta.createdInRun, ...out.newCreated }

  const newDone = end
  await sb.from('apulia_imports').update({
    progress_done: newDone,
    created: out.counters.created,
    updated: out.counters.updated,
    untagged: out.counters.untagged,
    unmatched: out.counters.unmatched,
    skipped: out.counters.skipped,
    payload_meta: { ...meta, createdInRun: newCreatedInRun },
    last_progress_at: new Date().toISOString(),
  }).eq('id', id)

  if (newDone < total) {
    await triggerPdpContinue(id)
    return NextResponse.json({ done: newDone, total, more: true })
  }

  return await runFinalize(sb, id, payload.rows, meta.colFieldMap, { ...row, ...out.counters, progress_done: newDone })
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
