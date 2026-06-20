// Seed demo data for Farmacia Cialdella so every module shows something.
// Everything is tagged 'demo' / prefixed DEMO- so it's easy to remove.
//   node scripts/farmacia-demo-seed.mjs         → insert (cleans prior demo first)
//   node scripts/farmacia-demo-seed.mjs --clean → remove demo data only
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const LOCATION = 'JhsFebrSPpgtXzUMa2wg'
const channelTag = (c) => ({ amazon: 'amazon', ebay: 'ebay', store: 'store', online_store: 'sito' }[c])
const iso = (d) => new Date(d + 'T10:00:00Z').toISOString()

async function clean() {
  await sb.from('farmacia_orders').delete().like('order_ext_id', 'DEMO-%')
  await sb.from('farmacia_reviews').delete().like('id', 'demo-%')
  const { data: demo } = await sb.from('farmacia_contacts').select('id').contains('tags', ['demo'])
  for (const c of demo ?? []) { await sb.from('farmacia_sync_queue').delete().eq('contact_id', c.id); await sb.from('farmacia_contacts').delete().eq('id', c.id) }
  await sb.from('cached_conversations').delete().eq('location_id', LOCATION).like('ghl_id', 'demo-%')
  console.log('cleaned prior demo data')
}

// [name, phone, channels with orders, override {orders,spendCents}]
const CUSTOMERS = [
  { first: 'Mario', last: 'Rossi', phone: '+393500000001', orders: [
    { ch: 'amazon', date: '2026-01-10', items: [['Vitamina C 1000', 'INT-001', 'Integratori', 1, 1990]] },
    { ch: 'online_store', date: '2026-03-15', items: [['Crema viso idratante', 'COS-002', 'Cosmetici', 2, 1450]] }, // conversion: amazon → sito
  ] },
  { first: 'Lucia', last: 'Bianchi', phone: '+393500000002', override: { orders: 6, spendCents: 31800 }, orders: [
    { ch: 'online_store', date: '2026-02-02', items: [['Integratore Magnesio', 'INT-010', 'Integratori', 1, 1290]] },
    { ch: 'online_store', date: '2026-04-20', items: [['Shampoo dermo', 'IGN-003', 'Igiene', 3, 890]] },
  ] },
  { first: 'Giuseppe', last: 'Verdi', phone: '+393500000003', override: { orders: 22, spendCents: 110000 }, orders: [
    { ch: 'amazon', date: '2026-01-22', items: [['Termometro digitale', 'FAR-020', 'Farmaci', 1, 1290]] },
    { ch: 'amazon', date: '2026-05-05', items: [['Cerotti assortiti', 'FAR-021', 'Farmaci', 2, 540]] },
  ] },
  { first: 'Anna', last: 'Neri', phone: '+393500000004', override: { orders: 55, spendCents: 300000 }, orders: [
    { ch: 'store', date: '2026-03-01', items: [['Profumo classico', 'COS-030', 'Cosmetici', 1, 4900]] },
  ] },
  { first: 'Paolo', last: 'Gallo', phone: '+393500000005', orders: [
    { ch: 'ebay', date: '2026-02-11', items: [['Spazzolino elettrico', 'IGN-040', 'Igiene', 1, 2990]] },
  ] },
  { first: 'Sara', last: 'Conti', phone: '+393500000006', orders: [
    { ch: 'ebay', date: '2026-02-18', items: [['Collagene marino', 'INT-050', 'Integratori', 1, 2490]] },
    { ch: 'online_store', date: '2026-04-09', items: [['Siero acido ialuronico', 'COS-051', 'Cosmetici', 1, 3200]] }, // ebay → sito conversion
  ] },
  { first: 'Marco', last: 'Ferrari', phone: '+393500000007', orders: [
    { ch: 'store', date: '2026-01-15', items: [['Misuratore pressione', 'FAR-060', 'Farmaci', 1, 3900]] },
    { ch: 'online_store', date: '2026-02-25', items: [['Integratore Omega 3', 'INT-061', 'Integratori', 2, 1750]] }, // store → sito conversion
  ] },
  { first: 'Elena', last: 'Russo', phone: '+393500000008', orders: [
    { ch: 'amazon', date: '2026-06-12', items: [['Salviette struccanti', 'IGN-070', 'Igiene', 1, 450]] },
  ] },
]

const REVIEWS = [
  ['Carla M.', 5, 'Servizio eccellente', 'Personale gentilissimo e prodotti sempre disponibili.', '2026-06-15'],
  ['Davide P.', 5, 'Consigliatissima', 'Spedizione velocissima, tutto perfetto.', '2026-06-10'],
  ['Giulia T.', 4, 'Molto bene', 'Buona scelta di integratori, prezzi nella media.', '2026-06-02'],
  ['Roberto L.', 3, 'Nella media', 'Ordine corretto ma consegna un po\' lenta.', '2026-05-20'],
  ['Francesca R.', 2, 'Da migliorare', 'Mancava un prodotto nell\'ordine.', '2026-04-28'],
  ['Stefano B.', 5, 'Top', 'La mia farmacia di fiducia anche online.', '2026-06-18'],
]

const CONVERSATIONS = [
  ['Mario Rossi', 'Grazie, ricevuto tutto!', '2026-06-18', 'inbound', 'TYPE_WHATSAPP'],
  ['Lucia Bianchi', 'Quando arriva il mio ordine?', '2026-06-17', 'inbound', 'TYPE_WHATSAPP'],
  ['Paolo Gallo', 'Promo attiva fino a domenica.', '2026-06-15', 'outbound', 'TYPE_PHONE'],
]

function rollup(orders) {
  const r = { ordersCount: orders.length, spend: 0, first: null, last: null, fAmazon: null, fEbay: null, fStore: null, fOnline: null }
  for (const o of orders) {
    const total = o.items.reduce((s, [, , , qty, unit]) => s + qty * unit, 0)
    r.spend += total
    const d = iso(o.date)
    r.first = !r.first || d < r.first ? d : r.first
    r.last = !r.last || d > r.last ? d : r.last
    if (o.ch === 'amazon') r.fAmazon = !r.fAmazon || d < r.fAmazon ? d : r.fAmazon
    if (o.ch === 'ebay') r.fEbay = !r.fEbay || d < r.fEbay ? d : r.fEbay
    if (o.ch === 'store') r.fStore = !r.fStore || d < r.fStore ? d : r.fStore
    if (o.ch === 'online_store') r.fOnline = !r.fOnline || d < r.fOnline ? d : r.fOnline
  }
  return r
}

async function seed() {
  await clean()
  let n = 0
  for (const cust of CUSTOMERS) {
    const r = rollup(cust.orders)
    const origins = [...new Set(cust.orders.map((o) => o.ch))]
    const marketFirst = [r.fAmazon, r.fEbay, r.fStore].filter(Boolean).sort()[0] ?? null
    const isConv = !!marketFirst && !!r.fOnline && r.fOnline > marketFirst
    const id = randomUUID()
    await sb.from('farmacia_contacts').insert({
      id, first_name: cust.first, last_name: cust.last, phone: cust.phone, phone_norm: cust.phone,
      email: `${cust.first.toLowerCase()}.demo@example.com`,
      tags: ['demo', 'cliente', ...origins.map(channelTag).filter(Boolean)],
      origin_tags: origins,
      orders_count: cust.override?.orders ?? r.ordersCount,
      total_spent_cents: cust.override?.spendCents ?? r.spend,
      first_order_at: r.first, last_order_at: r.last,
      first_marketplace_order_at: marketFirst, first_online_store_order_at: r.fOnline,
      is_conversion: isConv, converted_at: isConv ? r.fOnline : null,
      sync_status: 'synced',
    })
    for (const o of cust.orders) {
      const total = o.items.reduce((s, [, , , qty, unit]) => s + qty * unit, 0)
      const ext = `DEMO-${++n}`
      const { data: ord } = await sb.from('farmacia_orders').insert({
        order_ext_id: ext, contact_id: id, phone_norm: cust.phone, channel: o.ch,
        order_date: iso(o.date), total_cents: total, currency: 'EUR', category: o.items[0][2], status: 'completato',
        ship_name: `${cust.first} ${cust.last}`, ship_address: 'Via Demo 1', ship_city: 'Bari', ship_zip: '70100', ship_province: 'BA', ship_country: 'IT',
      }).select('id').single()
      await sb.from('farmacia_order_items').insert(o.items.map(([d, sku, cat, qty, unit]) => ({
        order_id: ord.id, order_ext_id: ext, sku, description: d, category: cat, qty, unit_price_cents: unit, line_total_cents: qty * unit,
      })))
    }
  }

  await sb.from('farmacia_reviews').insert(REVIEWS.map(([author, rating, title, body, date], i) => ({
    id: `demo-rev-${i + 1}`, location_id: LOCATION, rating, title, body, reviewer_name: author,
    platform: 'google', status: rating >= 4 ? 'replied' : 'pending', review_date: iso(date),
  })))

  await sb.from('cached_conversations').insert(CONVERSATIONS.map(([name, body, date, dir, type], i) => ({
    ghl_id: `demo-conv-${i + 1}`, location_id: LOCATION, contact_ghl_id: `demo-contact-${i + 1}`,
    contact_name: name, type, last_message_body: body, last_message_date: iso(date), last_message_direction: dir, unread_count: dir === 'inbound' ? 1 : 0,
  }))).then(({ error }) => error && console.log('conversations note:', error.message))

  console.log(`seeded ${CUSTOMERS.length} clienti, ${n} ordini, ${REVIEWS.length} recensioni, ${CONVERSATIONS.length} conversazioni`)
}

const arg = process.argv[2]
;(arg === '--clean' ? clean() : seed()).catch((e) => { console.error('FATAL', e.message); process.exit(1) })
