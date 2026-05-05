import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { getApuliaSession } from '@/lib/apulia/auth'
import { adminWithPods } from '@/lib/apulia/queries'
import { currentPeriod } from '@/lib/apulia/fields'
import { createAdminClient } from '@/lib/supabase-server'
import { fetchApuliaFieldGroups } from '@/lib/apulia/field-meta'
import PodTable from './_components/PodTable'
import MarkPaidButton from './_components/MarkPaidButton'
import ImpersonateButton from './_components/ImpersonateButton'
import AdminFullEditor from './_components/AdminFullEditor'
import DeleteContactButton from '../../_components/DeleteContactButton'
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

  // Payment history + raw custom fields for invoicing details
  const sb = createAdminClient()
  const [{ data: payments }, { data: contactRow }, fieldGroups] = await Promise.all([
    sb.from('apulia_payments').select('period, amount_cents, paid_at, paid_by, note').eq('contact_id', id).order('paid_at', { ascending: false }),
    sb.from('apulia_contacts').select('first_name, last_name, email, phone, tags, custom_fields').eq('id', id).maybeSingle(),
    fetchApuliaFieldGroups(),
  ])
  const customFields = (contactRow?.custom_fields ?? {}) as Record<string, string>
  const tags: string[] = (contactRow?.tags ?? []) as string[]

  const period = currentPeriod()
  const paidThisPeriod = (payments ?? []).find((p) => p.period === period)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Link href="/designs/apulia-power/amministratori" style={{ fontSize: 13, color: 'var(--ap-text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, width: 'fit-content' }}>
        ← Tutti gli amministratori
      </Link>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="ap-page-title">{admin.name}</h1>
          <p className="ap-page-subtitle">
            {admin.email && <>{admin.email} · </>}
            Cod. Amm.: <strong style={{ fontFamily: 'monospace' }}>{admin.codiceAmministratore ?? '—'}</strong> ·
            Compenso per POD: <strong>{fmtEur(admin.compensoPerPod)}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <MarkPaidButton adminContactId={id} amount={admin.total} alreadyPaid={admin.paidThisPeriod} />
          <ImpersonateButton adminContactId={id} />
          <DeleteContactButton
            contactId={id}
            action={deleteAdmin}
            label="Elimina amministratore"
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
        <div className="ap-stat" data-tone={admin.paidThisPeriod ? 'good' : 'warn'}>
          <div className="ap-stat-label">Periodo {period}</div>
          <div className="ap-stat-value">{fmtEur(admin.total)}</div>
          <div className="ap-stat-foot">{admin.paidThisPeriod ? `Pagato il ${admin.paidAt ? new Date(admin.paidAt).toLocaleDateString('it-IT') : ''}` : 'Da pagare'}</div>
        </div>
      </div>

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
        groups={fieldGroups}
      />

      <section className="ap-card">
        <header style={{ padding: '14px 20px', borderBottom: '1px solid var(--ap-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 14, fontWeight: 800 }}>Condomini attivi <span style={{ color: 'var(--ap-text-faint)', fontWeight: 500 }}>· {activePods.length}</span></h2>
          <span className="ap-pill" data-tone="blue">Inclusi nella commissione</span>
        </header>
        <PodTable pods={activePods} defaultAmount={admin.compensoPerPod} adminContactId={id} />
      </section>

      <section className="ap-card">
        <header style={{ padding: '14px 20px', borderBottom: '1px solid var(--ap-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 14, fontWeight: 800 }}>Switch-out <span style={{ color: 'var(--ap-text-faint)', fontWeight: 500 }}>· {switchedPods.length}</span></h2>
          <span className="ap-pill" data-tone="gray">Esclusi dalla commissione</span>
        </header>
        <PodTable pods={switchedPods} defaultAmount={admin.compensoPerPod} adminContactId={id} />
      </section>

      <section className="ap-card">
        <header style={{ padding: '14px 20px', borderBottom: '1px solid var(--ap-line)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 800 }}>Storico pagamenti</h2>
        </header>
        <table className="ap-table">
          <thead>
            <tr><th>Periodo</th><th style={{ textAlign: 'right' }}>Importo</th><th>Pagato il</th><th>Da</th><th>Nota</th></tr>
          </thead>
          <tbody>
            {(payments ?? []).length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--ap-text-faint)' }}>Nessun pagamento registrato.</td></tr>}
            {(payments ?? []).map((p) => (
              <tr key={p.period}>
                <td style={{ fontWeight: 600 }}>{p.period}{p.period === period && <span className="ap-pill" data-tone="blue" style={{ marginLeft: 8, fontSize: 9 }}>corrente</span>}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtEur(p.amount_cents / 100)}</td>
                <td>{new Date(p.paid_at).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td style={{ color: 'var(--ap-text-muted)', fontSize: 12 }}>{p.paid_by ?? '—'}</td>
                <td style={{ color: 'var(--ap-text-muted)', fontSize: 12 }}>{p.note ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {paidThisPeriod && <div style={{ padding: '12px 20px', fontSize: 12, color: 'var(--ap-text-muted)' }}>Periodo corrente già archiviato.</div>}
      </section>
    </div>
  )
}
