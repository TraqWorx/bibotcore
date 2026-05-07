import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { getApuliaSession } from '@/lib/apulia/auth'
import { adminWithPods } from '@/lib/apulia/queries'
import { createAdminClient } from '@/lib/supabase-server'
import { fetchApuliaFieldGroups } from '@/lib/apulia/field-meta'
import PodTable from './_components/PodTable'
import ImpersonateButton from './_components/ImpersonateButton'
import AdminFullEditor from './_components/AdminFullEditor'
import { listDistinctTags } from '@/lib/apulia/tags'
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

  const sb = createAdminClient()
  const [{ data: payments }, { data: contactRow }, fieldGroups, tagSuggestions] = await Promise.all([
    sb.from('apulia_payments').select('id, period, amount_cents, paid_at, paid_by, note, pod_contact_id').eq('contact_id', id).order('paid_at', { ascending: false }),
    sb.from('apulia_contacts').select('first_name, last_name, email, phone, tags, custom_fields, sync_status, sync_error, ghl_id').eq('id', id).maybeSingle(),
    fetchApuliaFieldGroups(),
    listDistinctTags(),
  ])
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
        <div className="ap-stat" data-tone={admin.overdueCount && admin.overdueCount > 0 ? 'warn' : 'good'}>
          <div className="ap-stat-label">Da pagare ora</div>
          <div className="ap-stat-value">{fmtEur(admin.total)}</div>
          <div className="ap-stat-foot">
            {admin.overdueCount && admin.overdueCount > 0
              ? `${admin.overdueCount} POD da pagare · ciclo 6 mesi per POD`
              : admin.podsActive > 0
                ? 'Tutti i POD pagati'
                : 'Nessun POD attivo'}
          </div>
        </div>
        <div className="ap-stat" data-tone="neutral">
          <div className="ap-stat-label">Prossima scadenza</div>
          <div className="ap-stat-value" style={{ fontSize: 18 }}>
            {admin.nextDueDate ? new Date(admin.nextDueDate).toLocaleDateString('it-IT') : '—'}
          </div>
          <div className="ap-stat-foot">
            {admin.nextDueDate
              ? 'POD pagato più di recente — scade tra 6 mesi'
              : 'In attesa del primo pagamento'}
          </div>
        </div>
      </div>

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
                    <tr><th>Pagato il</th><th>POD</th><th style={{ textAlign: 'right' }}>Importo</th><th>Da</th><th>Nota</th></tr>
                  </thead>
                  <tbody>
                    {(payments ?? []).length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--ap-text-faint)' }}>Nessun pagamento registrato.</td></tr>}
                    {(payments ?? []).map((p) => {
                      const r = p as { id: string; period: string; amount_cents: number; paid_at: string; paid_by: string | null; note: string | null; pod_contact_id: string | null }
                      const podLabel = r.pod_contact_id ? podLabelMap.get(r.pod_contact_id) : null
                      return (
                      <tr key={r.id}>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{new Date(r.paid_at).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td style={{ fontFamily: r.pod_contact_id ? 'monospace' : undefined, fontSize: 12 }}>
                          {podLabel ?? <span style={{ color: 'var(--ap-text-muted)', fontStyle: 'italic' }}>tutto l&apos;amministratore</span>}
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmtEur(r.amount_cents / 100)}</td>
                        <td style={{ color: 'var(--ap-text-muted)', fontSize: 12 }}>{r.paid_by ?? '—'}</td>
                        <td style={{ color: 'var(--ap-text-muted)', fontSize: 12 }}>{r.note ?? ''}</td>
                      </tr>
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
