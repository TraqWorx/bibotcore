import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { isBibotAgency } from '@/lib/isBibotAgency'
import { parseSpreadsheet } from '@/lib/apulia/spreadsheet'
import { mapRow, groupIntoOrders } from '@/lib/farmacia/transform'
import { SHIPPYPRO_MAP, MARKET_ROCK_MAP } from '@/lib/farmacia/import-config'
import { persistOrderImport } from '@/lib/farmacia/import-orders'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Order import for Farmacia Cialdella. Parses an uploaded ShippyPro (or Market
 * Rock) file, maps + groups rows into orders, then persists contacts/orders/
 * items and enqueues GHL sync ops. DB-first — the sync worker pushes to GHL
 * asynchronously, so there's no rate-limit risk here.
 *
 * Query param `?source=marketrock` switches the column map.
 */
export async function POST(req: NextRequest) {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id, role').eq('id', user.id).single()
  const isOwner = (profile?.agency_id && isBibotAgency(profile.agency_id)) || profile?.role === 'super_admin'
  if (!isOwner || (profile?.role !== 'admin' && profile?.role !== 'super_admin')) {
    return new Response('Forbidden', { status: 403 })
  }

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return new Response('Missing file', { status: 400 })

  const { rows } = await parseSpreadsheet(file)
  if (rows.length === 0) return new Response('Empty file', { status: 400 })

  const columnMap = req.nextUrl.searchParams.get('source') === 'marketrock' ? MARKET_ROCK_MAP : SHIPPYPRO_MAP
  const orders = groupIntoOrders(rows.map((r) => mapRow(r, columnMap)))

  // SKU/EAN → category fallback map.
  const skuMap = new Map<string, string>()
  const eanMap = new Map<string, string>()
  const { data: cats } = await sb.from('farmacia_category_map').select('sku, ean, category')
  for (const c of cats ?? []) {
    if (c.sku) skuMap.set(c.sku, c.category)
    if (c.ean) eanMap.set(c.ean, c.category)
  }

  const { data: imp } = await sb.from('farmacia_imports').insert({
    kind: 'orders',
    origin: 'market_rock',
    filename: file.name,
    rows_total: rows.length,
    progress_total: rows.length,
    status: 'running',
    triggered_by: user.email ?? null,
  }).select('id').single()
  const importId = imp?.id as string | undefined

  // Store the original file for download (best-effort).
  let fileUrl: string | null = null
  try {
    const buf = Buffer.from(await file.arrayBuffer())
    const path = `${importId}/${file.name}`
    const up = await sb.storage.from('farmacia-imports').upload(path, buf, { contentType: file.type || 'application/octet-stream', upsert: true })
    if (!up.error) fileUrl = sb.storage.from('farmacia-imports').getPublicUrl(path).data.publicUrl
  } catch { /* non-fatal */ }

  const started = Date.now()
  try {
    const summary = await persistOrderImport(orders, { skuMap, eanMap, importId: importId ?? null })
    await sb.from('farmacia_imports').update({
      status: 'completed',
      file_url: fileUrl,
      created: summary.contactsCreated,
      updated: summary.contactsUpdated,
      orders_created: summary.ordersUpserted,
      items_created: summary.itemsInserted,
      conversions: summary.conversions,
      unmatched: summary.ordersUnlinked,
      duration_ms: Date.now() - started,
      progress_done: rows.length,
      finished_at: new Date().toISOString(),
      summary,
    }).eq('id', importId!)
    return NextResponse.json({ importId, orders: orders.length, ...summary })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import failed'
    if (importId) {
      await sb.from('farmacia_imports').update({
        status: 'failed', error_msg: message, finished_at: new Date().toISOString(),
      }).eq('id', importId)
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
