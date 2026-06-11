import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { getApuliaSession } from '@/lib/apulia/auth'
import { adminWithPods } from '@/lib/apulia/queries'
import { createAdminClient } from '@/lib/supabase-server'
import { fetchApuliaFieldGroups } from '@/lib/apulia/field-meta'
import PodTable from './_components/PodTable'
import PaymentRow from './_components/PaymentRow'
import ImpersonateButton from './_components/ImpersonateButton'
import AdminFullEditor from './_components/AdminFullEditor'
import PaymentRuleField from './_components/PaymentRuleField'
import { listDistinctTags } from '@/lib/apulia/tags'
import { getDefaultPaymentOffset } from '@/lib/apulia/payment-cycle'
import DeleteContactButton from '../../_components/DeleteContactButton'
import SettingsTabs from '../../settings/_components/SettingsTabs'
import { deleteAdmin } from './_actions'

export const dynamic = 'force-dynamic'

function fmtEur(n: number): string {
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await getApuliaSession()
  if (session.role !== 'owner') redirect('/designs/apulia-power/dashboard')
  const { id } = await params

  const { admin, activePods, switchedPods } = await adminWithPods(id)
  if (!admin) notFound()

  // Header figures: total commission (overall "to pay") + the next single payment.
  const totalCommission = activePods.reduce((s, p) => s + (p.amount || 0), 0)
  const dueDates = activePods.map((p) => p.nextDueDate).filter((d): d is string => !!d).sort()
  const nextPaymentDate = dueDates[0]
  const nextPaymentAmount = nextPaymentDate
    ? activePods.filter((p) => p.nextDueDate && p.nextDueDate.slice(0, 10) === nextPaymentDate.slice(0, 10)).reduce((s, p) => s + (p.amount || 0), 0)
    : 0
  const nextPaymentOverdue = nextPaymentDate ? new Date(nextPaymentDate).getTime() <= Date.now() : false

  const sb = createAdminClient()
  const [{ data: payments }, { data: contactRow }, fieldGroups, tagSuggestions] = await Promise.all([
    sb.from('apulia_payments').select('id, period, amount_cents, paid_at, paid_by, note, pod_contact_id, proof_url, proof_name').eq('contact_id', id).order('paid_at', { ascending: false }),
    sb.from('apulia_contacts').select('first_name, last_name, email, phone, tags, custom_fields, sync_status, sync_error, ghl_id').eq('id', id).maybeSingle(),
    fetchApuliaFieldGroups(),
    listDistinctTags(),
  ])
  const defaultOffset = await getDefaultPaymentOffset()
  const customFields = (contactRow?.custom_fields ?? {}) as Record<string, string>
  const tags: string[] = (contactRow?.tags ?? []) as string[]
  const syncStatus = (contactRow as { sync_status?: string } | null)?.sync_status
  const syncError = (contactRow as { sync_error?: string | null } | null)?.sync_error
  const ghlId = (contactRow as { ghl_id?: string | null } | null)?.ghl_id

  // Resolve pod_contact_id → POD/PDR for display in storico pagamenti.
  const podIds = Array.from(new Set((payments ?? []).map((p) => (p as { pod_contact_id?: string | null }).pod_contact_id).filter(Boolean) as string[]))
  const podLabelMap = new Map<string, string>()
  if (podIds.length > 0) {
    const { data: podRows } = await sb.from('apulia_contacts').select('id, pod_pdr, first_name, last_name').in('id', podIds)
    for (const r of (podRows ?? []) as Array<{ id: string; pod_pdr: string | null; first_name: string | null; last_name: string | null }>) {
      const cliente = [r.first_name, r.last_name].filter(Boolean).join(' ')
      podLabelMap.set(r.id, [r.pod_pdr, cliente].filter(Boolean).join(' · ') || r.pod_pdr || cliente || r.id)
    }
  }


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Link href="/designs/apulia-power/amministratori" style={{ fontSize: 13, color: 'var(--ap-text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, width: 'fit-content' }}>
        ← Tutti gli amministratori
      </Link>

      {syncStatus === 'failed' && (
        <div style={{ padding: '14px 18px', borderRadius: 8, background: 'color-mix(in srgb, var(--ap-danger, #dc2626) 12%, transparent)', border: '1px solid var(--ap-danger, #dc2626)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <strong style={{ color: 'var(--ap-danger, #dc2626)', fontSize: 13 }}>⚠ Non sincronizzato</strong>
          <span style={{ fontSize: 12, color: 'var(--ap-text)', lineHeight: 1.5 }}>
            {syncError ?? 'Sincronizzazione fallita. Modifica i dati in conflitto per riprovare.'}
          </span>
          <span style={{ fontSize: 11, color: 'var(--ap-text-muted)' }}>
            {ghlId
              ? <>ID esterno: <code style={{ fontFamily: 'monospace' }}>{ghlId}</code></>
              : 'Questo contatto non è ancora sincronizzato. Modificalo per ritentare automaticamente.'}
          </span>
        </div>
      )}

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="ap-page-title">{admin.name}</h1>
          <p className="ap-page-subtitle">
            {admin.email && <>{admin.email} · </>}
            Cod. Amm.: <strong style={{ fontFamily: 'monospace' }}>{admin.codiceAmministratore ?? '—'}</strong> ·
            Compenso per POD: <strong>{fmtEur(admin.compensoPerPod)}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <ImpersonateButton adminContactId={id} />
          <DeleteContactButton
            contactId={id}
            action={deleteAdmin}
            label="Elimina"
            confirmText={`Eliminare l'amministratore ${admin.name}?\nQuesta azione non si può annullare.`}
          />
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <div className="ap-stat" data-tone="accent">
          <div className="ap-stat-label">POD attivi</div>
          <div className="ap-stat-value">{admin.podsActive}</div>
        </div>
        <div className="ap-stat" data-tone="warn">
          <div className="ap-stat-label">Switch-out</div>
          <div className="ap-stat-value">{admin.podsSwitchedOut}</div>
        </div>
        <div className="ap-stat" data-tone="accent">
          <div className="ap-stat-label">Da Pagare</div>
          <div className="ap-stat-value">{fmtEur(totalCommission)}</div>
          <div className="ap-stat-foot">Totale commissione · {admin.podsActive} POD attivi</div>
        </div>
        <div className="ap-stat" data-tone={nextPaymentOverdue ? 'warn' : 'neutral'}>
          <div className="ap-stat-label">Prossimo Pagamento</div>
          <div className="ap-stat-value" style={{ color: nextPaymentOverdue ? 'var(--ap-danger)' : undefined }}>{fmtEur(nextPaymentAmount)}</div>
          <div className="ap-stat-foot" style={{ color: nextPaymentOverdue ? 'var(--ap-danger)' : undefined }}>
            {nextPaymentDate ? new Date(nextPaymentDate).toLocaleDateString('it-IT') : '—'}
          </div>
        </div>
      </div>

      <PaymentRuleField contactId={id} offsetDays={admin.paymentOffsetDays ?? null} defaultOffset={defaultOffset} />

      <SettingsTabs
        tabs={[
          {
            id: 'condomini',
            label: 'Condomini attivi',
            badge: activePods.length || undefined,
            content: (
              <section className="ap-card">
                <header style={{ padding: '14px 20px', borderBottom: '1px solid var(--ap-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: 14, fontWeight: 800 }}>Condomini attivi <span style={{ color: 'var(--ap-text-faint)', fontWeight: 500 }}>· {activePods.length}</span></h2>
                  <span className="ap-pill" data-tone="blue">Inclusi nella commissione</span>
                </header>
                <PodTable pods={activePods} defaultAmount={admin.compensoPerPod} adminContactId={id} />
              </section>
            ),
          },
          {
            id: 'switchout',
            label: 'Switch-out',
            badge: switchedPods.length || undefined,
            content: (
              <section className="ap-card">
                <header style={{ padding: '14px 20px', borderBottom: '1px solid var(--ap-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: 14, fontWeight: 800 }}>Switch-out <span style={{ color: 'var(--ap-text-faint)', fontWeight: 500 }}>· {switchedPods.length}</span></h2>
                  <span className="ap-pill" data-tone="gray">Esclusi dalla commissione</span>
                </header>
                <PodTable pods={switchedPods} defaultAmount={admin.compensoPerPod} adminContactId={id} payable={false} />
              </section>
            ),
          },
          {
            id: 'pagamenti',
            label: 'Storico pagamenti',
            badge: payments?.length || undefined,
            content: (
              <section className="ap-card">
                <header style={{ padding: '14px 20px', borderBottom: '1px solid var(--ap-line)' }}>
                  <h2 style={{ fontSize: 14, fontWeight: 800 }}>Storico pagamenti</h2>
                </header>
                <table className="ap-table">
                  <thead>
                    <tr>
                      <th>Pagato il</th>
                      <th>POD</th>
                      <th style={{ textAlign: 'right' }}>Importo</th>
                      <th>Da</th>
                      <th>Nota</th>
                      <th>Allegato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(payments ?? []).length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--ap-text-faint)' }}>Nessun pagamento registrato.</td></tr>}
                    {(payments ?? []).map((p) => {
                      const r = p as { id: string; period: string; amount_cents: number; paid_at: string; paid_by: string | null; note: string | null; pod_contact_id: string | null; proof_url: string | null; proof_name: string | null }
                      const podLabel = r.pod_contact_id ? (podLabelMap.get(r.pod_contact_id) ?? null) : null
                      return (
                        <PaymentRow
                          key={r.id}
                          adminContactId={id}
                          podLabel={podLabel}
                          payment={{
                            id: r.id,
                            paid_at: r.paid_at,
                            amount_cents: r.amount_cents,
                            paid_by: r.paid_by,
                            note: r.note,
                            pod_contact_id: r.pod_contact_id,
                            proof_url: r.proof_url,
                            proof_name: r.proof_name,
                          }}
                        />
                      )
                    })}
                  </tbody>
                </table>
              </section>
            ),
          },
          {
            id: 'dettagli',
            label: 'Dettagli contatto',
            content: (
              <AdminFullEditor
                contactId={id}
                core={{
                  firstName: contactRow?.first_name ?? '',
                  lastName: contactRow?.last_name ?? '',
                  email: contactRow?.email ?? '',
                  phone: contactRow?.phone ?? '',
                }}
                customFields={customFields}
                tags={tags}
                tagSuggestions={tagSuggestions}
                groups={fieldGroups}
              />
            ),
          },
        ]}
      />
    </div>
  )
}
