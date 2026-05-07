import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getApuliaSession } from '@/lib/apulia/auth'
import { listAdminsWithStats } from '@/lib/apulia/queries'
import { createAdminClient } from '@/lib/supabase-server'
import { currentPeriod } from '@/lib/apulia/fields'

export const dynamic = 'force-dynamic'

function fmtEur(n: number): string { return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }) }

interface PaymentRow {
  id: string
  contact_id: string
  pod_contact_id: string | null
  period: string
  amount_cents: number
  paid_at: string
  paid_by: string | null
}

export default async function Page() {
  const session = await getApuliaSession()
  if (session.role !== 'owner') redirect('/designs/apulia-power/dashboard')

  const period = currentPeriod()
  const admins = await listAdminsWithStats()

  const sb = createAdminClient()
  const { data: rawPayments } = await sb.from('apulia_payments')
    .select('id, contact_id, pod_contact_id, period, amount_cents, paid_at, paid_by')
    .order('paid_at', { ascending: false })
  const payments = (rawPayments ?? []) as PaymentRow[]

  // Resolve pod_contact_id → POD/PDR label so each payment row can show
  // exactly which condominio was paid.
  const podIds = Array.from(new Set(payments.map((p) => p.pod_contact_id).filter((x): x is string => !!x)))
  const podLabelMap = new Map<string, string>()
  if (podIds.length > 0) {
    const { data: podRows } = await sb.from('apulia_contacts').select('id, pod_pdr, first_name, last_name').in('id', podIds)
    for (const r of (podRows ?? []) as Array<{ id: string; pod_pdr: string | null; first_name: string | null; last_name: string | null }>) {
      const cliente = [r.first_name, r.last_name].filter(Boolean).join(' ')
      podLabelMap.set(r.id, [r.pod_pdr, cliente].filter(Boolean).join(' · ') || r.pod_pdr || cliente || r.id)
    }
  }

  // Bucket each payment by semester (H1/H2 of paid_at year). Per-POD rows
  // have a synthetic period string ("pod-{id}-{ts}") that's not human-
  // readable, so we always derive the bucket from paid_at instead. Legacy
  // admin-level rows that already have a real period code (e.g. "2026-H1")
  // still land in the right bucket because currentPeriod(paid_at) returns
  // the same value.
  const bucketed = new Map<string, PaymentRow[]>()
  for (const p of payments) {
    const bucket = currentPeriod(new Date(p.paid_at))
    let arr = bucketed.get(bucket)
    if (!arr) { arr = []; bucketed.set(bucket, arr) }
    arr.push(p)
  }
  // Always include the current period even if no payments yet recorded.
  if (!bucketed.has(period)) bucketed.set(period, [])

  const buckets = [...bucketed.keys()].sort().reverse()
  const adminById = new Map(admins.map((a) => [a.contactId, a]))
  const dueAdmins = admins.filter((a) => a.isDueNow && a.total > 0)
  const dueTotalAll = dueAdmins.reduce((s, a) => s + a.total, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header>
        <h1 className="ap-page-title">Pagamenti</h1>
        <p className="ap-page-subtitle">Storico pagamenti raggruppato per semestre. Periodo corrente: <strong>{period}</strong>.</p>
      </header>

      {buckets.map((bucket) => {
        const bucketPayments = bucketed.get(bucket) ?? []
        const isCurrent = bucket === period
        const totalPaid = bucketPayments.reduce((s, p) => s + p.amount_cents, 0) / 100
        return (
          <section key={bucket} className="ap-card">
            <header style={{ padding: '14px 20px', borderBottom: '1px solid var(--ap-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800 }}>
                Periodo {bucket}
                {isCurrent && <span className="ap-pill" data-tone="blue" style={{ marginLeft: 10, fontSize: 10 }}>corrente</span>}
                <span style={{ color: 'var(--ap-text-faint)', fontWeight: 500, marginLeft: 8 }}>· {bucketPayments.length} pagamenti</span>
              </h2>
              <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                <span>Pagati: <strong>{fmtEur(totalPaid)}</strong></span>
                {isCurrent && dueTotalAll > 0 && (
                  <span>In sospeso: <strong style={{ color: 'var(--ap-warning)' }}>{fmtEur(dueTotalAll)}</strong></span>
                )}
              </div>
            </header>
            <table className="ap-table">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Amministratore</th>
                  <th>POD</th>
                  <th style={{ textAlign: 'right' }}>Importo</th>
                  <th>Da</th>
                  <th>Stato</th>
                </tr>
              </thead>
              <tbody>
                {bucketPayments.length === 0 && !isCurrent && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--ap-text-faint)' }}>Nessun pagamento.</td></tr>
                )}
                {bucketPayments.map((p) => {
                  const a = adminById.get(p.contact_id)
                  const podLabel = p.pod_contact_id ? podLabelMap.get(p.pod_contact_id) : null
                  return (
                    <tr key={p.id}>
                      <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>
                        {new Date(p.paid_at).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td>
                        <Link href={`/designs/apulia-power/amministratori/${p.contact_id}`} style={{ color: 'var(--ap-text)', textDecoration: 'none', fontWeight: 600 }}>
                          {a?.name ?? p.contact_id}
                        </Link>
                      </td>
                      <td style={{ fontFamily: p.pod_contact_id ? 'monospace' : undefined, fontSize: 12 }}>
                        {podLabel ?? <span style={{ color: 'var(--ap-text-muted)', fontStyle: 'italic' }}>tutto l&apos;amministratore</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmtEur(p.amount_cents / 100)}</td>
                      <td style={{ color: 'var(--ap-text-muted)', fontSize: 12 }}>{p.paid_by ?? '—'}</td>
                      <td><span className="ap-pill" data-tone="green">✓ Pagato</span></td>
                    </tr>
                  )
                })}
                {isCurrent && dueAdmins.map((a) => (
                  <tr key={`due-${a.contactId}`}>
                    <td>—</td>
                    <td>
                      <Link href={`/designs/apulia-power/amministratori/${a.contactId}`} style={{ color: 'var(--ap-text)', textDecoration: 'none', fontWeight: 600 }}>
                        {a.name}
                      </Link>
                    </td>
                    <td style={{ color: 'var(--ap-text-muted)', fontSize: 12, fontStyle: 'italic' }}>
                      {a.overdueCount && a.overdueCount > 0 ? `${a.overdueCount} POD da pagare` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtEur(a.total)}</td>
                    <td>—</td>
                    <td><span className="ap-pill" data-tone="amber">Da pagare</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )
      })}
    </div>
  )
}
