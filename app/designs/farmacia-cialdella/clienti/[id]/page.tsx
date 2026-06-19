import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase-server'
import { getSegmentConfig, computeTier, averageOrderCents } from '@/lib/farmacia/segments'

export const dynamic = 'force-dynamic'

function euros(c: number | null) { return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format((c ?? 0) / 100) }

interface Contact {
  id: string; first_name: string | null; last_name: string | null; phone_norm: string | null; email: string | null
  origin_tags: string[] | null; orders_count: number; total_spent_cents: number; is_conversion: boolean
  first_order_at: string | null; last_order_at: string | null; converted_at: string | null; tier: string | null; sync_status: string
}
interface Order { id: string; order_ext_id: string; channel: string; order_date: string | null; total_cents: number | null; category: string | null }

export default async function ClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = createAdminClient()
  const [{ data: c }, { data: orders }, config] = await Promise.all([
    sb.from('farmacia_contacts').select('id, first_name, last_name, phone_norm, email, origin_tags, orders_count, total_spent_cents, is_conversion, first_order_at, last_order_at, converted_at, tier, sync_status').eq('id', id).maybeSingle(),
    sb.from('farmacia_orders').select('id, order_ext_id, channel, order_date, total_cents, category').eq('contact_id', id).order('order_date', { ascending: false, nullsFirst: false }).limit(200),
    getSegmentConfig(),
  ])
  if (!c) notFound()
  const contact = c as Contact
  const tier = computeTier(contact.orders_count, contact.total_spent_cents, config)
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.phone_norm || contact.email || '—'
  const rows = (orders ?? []) as Order[]

  const facts = [
    { label: 'Ordini', value: String(contact.orders_count) },
    { label: 'Spesa totale', value: euros(contact.total_spent_cents) },
    { label: 'Scontrino medio', value: euros(averageOrderCents(contact.total_spent_cents, contact.orders_count)) },
    { label: 'Livello', value: tier?.name ?? '—' },
  ]

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <Link href="/designs/farmacia-cialdella/clienti" style={{ fontSize: 13, color: 'var(--fc-blue)', textDecoration: 'none' }}>← Clienti</Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0 4px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>{name}</h1>
        {tier && <span className="fc-pill" data-tone={tier.color ?? 'gray'}>{tier.name}</span>}
        {contact.is_conversion && <span className="fc-pill" data-tone="green">conversione</span>}
      </div>
      <p style={{ color: 'var(--fc-text-muted)', marginBottom: 20 }}>
        {contact.phone_norm ?? '—'} · {contact.email ?? '—'} · canali: {(contact.origin_tags ?? []).join(', ') || '—'}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 16, marginBottom: 8 }}>
        {facts.map((f) => (
          <div key={f.label} className="fc-stat" data-tone="neutral">
            <div style={{ fontSize: 22, fontWeight: 800 }}>{f.value}</div>
            <div style={{ fontSize: 12, color: 'var(--fc-text-muted)', marginTop: 4 }}>{f.label}</div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 13, color: 'var(--fc-text-faint)', marginBottom: 24 }}>
        Primo ordine: {contact.first_order_at ? new Date(contact.first_order_at).toLocaleDateString('it-IT') : '—'} ·
        Ultimo: {contact.last_order_at ? new Date(contact.last_order_at).toLocaleDateString('it-IT') : '—'}
        {contact.converted_at ? ` · Convertito il ${new Date(contact.converted_at).toLocaleDateString('it-IT')}` : ''}
      </p>

      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Ordini ({rows.length})</h2>
      <div className="fc-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="fc-table" style={{ width: '100%' }}>
          <thead><tr><th>Ordine</th><th>Canale</th><th>Categoria</th><th>Totale</th><th>Data</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} style={{ padding: 16, color: 'var(--fc-text-muted)' }}>Nessun ordine.</td></tr>}
            {rows.map((o) => (
              <tr key={o.id}>
                <td style={{ fontSize: 13 }}>{o.order_ext_id}</td>
                <td><span className="fc-pill" data-tone={o.channel === 'online_store' ? 'green' : o.channel === 'other' ? 'gray' : 'blue'}>{o.channel}</span></td>
                <td style={{ fontSize: 13 }}>{o.category ?? '—'}</td>
                <td>{euros(o.total_cents)}</td>
                <td style={{ fontSize: 13 }}>{o.order_date ? new Date(o.order_date).toLocaleDateString('it-IT') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
