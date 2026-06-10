import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { getApuliaSession } from '@/lib/apulia/auth'
import { createAdminClient } from '@/lib/supabase-server'
import { fetchApuliaFieldGroups } from '@/lib/apulia/field-meta'
import { APULIA_FIELD } from '@/lib/apulia/fields'
import { normalizePod } from '@/lib/apulia/cache'
import { listAdminPickerOptions } from '@/lib/apulia/queries-cached'
import { listDistinctTags } from '@/lib/apulia/tags'
import { listStores } from '@/lib/apulia/stores'
import { computeNextDue, getDefaultPaymentOffset } from '@/lib/apulia/payment-cycle'
import CondominoEditor from './_components/CondominoEditor'
import PodPaymentField from './_components/PodPaymentField'
import SwitchOutDateField from './_components/SwitchOutDateField'
import StoreField from './_components/StoreField'
import SettingsTabs from '../../settings/_components/SettingsTabs'
import DeleteContactButton from '../../_components/DeleteContactButton'
import { deleteCondomino } from './_actions'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await getApuliaSession()
  if (session.role !== 'owner') redirect('/designs/apulia-power/dashboard')
  const { id } = await params

  const sb = createAdminClient()
  const [{ data: contact }, fieldGroups, adminOptions, tagSuggestions, storesList] = await Promise.all([
    sb.from('apulia_contacts').select('*').eq('id', id).maybeSingle(),
    fetchApuliaFieldGroups(),
    listAdminPickerOptions(),
    listDistinctTags(),
    listStores(),
  ])
  const storeOptions = storesList.map((s) => ({ slug: s.slug, name: s.name }))
  if (!contact || contact.is_amministratore) notFound()
  const syncStatus = (contact as { sync_status?: string }).sync_status
  const syncError = (contact as { sync_error?: string | null }).sync_error
  const ghlId = (contact as { ghl_id?: string | null }).ghl_id

  const cf = (contact.custom_fields ?? {}) as Record<string, string>
  const tags: string[] = contact.tags ?? []
  // POD/PDR can come in scientific notation from older imports — normalize for display.
  const rawPod = (cf[APULIA_FIELD.POD_PDR] as string | undefined) ?? contact.pod_pdr ?? ''
  const podPdr = normalizePod(rawPod) ?? '—'
  const cliente = (cf[APULIA_FIELD.CLIENTE] as string | undefined) ?? contact.cliente ?? contact.first_name ?? '—'
  const codiceAmm = (cf[APULIA_FIELD.CODICE_AMMINISTRATORE] as string | undefined) ?? contact.codice_amministratore ?? ''
  const adminName = (cf[APULIA_FIELD.AMMINISTRATORE_CONDOMINIO] as string | undefined) ?? contact.amministratore_name ?? ''

  // Find the linked admin by code: id + compenso for the payment widget,
  // plus the admin's own details to show in the "Amministratore" tab (these
  // live on the admin record, not duplicated onto the building).
  let adminContactId: string | null = null
  let adminCompenso = 0
  let adminOffset: number | null = null
  let adminInfo: { id: string; name: string; cf: string; piva: string; phone: string; email: string; compenso: number } | null = null
  if (codiceAmm) {
    const { data: a } = await sb
      .from('apulia_contacts')
      .select('id, first_name, last_name, email, phone, compenso_per_pod, custom_fields, payment_offset_days')
      .eq('is_amministratore', true)
      .eq('codice_amministratore', codiceAmm)
      .maybeSingle()
    if (a) {
      adminContactId = a.id
      adminCompenso = Number(a.compenso_per_pod) || 0
      adminOffset = (a as { payment_offset_days?: number | null }).payment_offset_days ?? null
      const acf = (a.custom_fields ?? {}) as Record<string, string>
      adminInfo = {
        id: a.id,
        name: [a.first_name, a.last_name].filter(Boolean).join(' ') || adminName || '—',
        cf: acf[APULIA_FIELD.CODICE_FISCALE_AMMINISTRATORE] ?? '',
        piva: acf[APULIA_FIELD.PARTITA_IVA_AMMINISTRATORE] ?? '',
        phone: acf[APULIA_FIELD.TELEFONO_AMMINISTRATORE] ?? a.phone ?? '',
        email: a.email ?? acf[APULIA_FIELD.EMAIL_BILLING] ?? '',
        compenso: Number(a.compenso_per_pod) || 0,
      }
    }
  }

  // Per-POD payment status: anchor on first_payment_at (else cached_at).
  const firstPaymentAt = (contact as { first_payment_at?: string | null }).first_payment_at ?? null
  const cachedAt = (contact as { cached_at?: string }).cached_at
  const anchorIso = firstPaymentAt ?? cachedAt ?? null
  const { data: podPays } = await sb.from('apulia_payments').select('paid_at').eq('pod_contact_id', id)
  const paidCount = podPays?.length ?? 0
  const effectiveOffset = adminOffset ?? (await getDefaultPaymentOffset())
  const nd = computeNextDue(anchorIso, effectiveOffset, paidCount)
  const nextDueDate: string | null = nd ? nd.toISOString() : null
  const isDueNow = nd ? nd.getTime() <= Date.now() : false
  const override = Number(contact.pod_override) || 0
  const podAmount = override > 0 ? override : adminCompenso

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Link href="/designs/apulia-power/condomini" style={{ fontSize: 13, color: 'var(--ap-text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, width: 'fit-content' }}>
        ← Tutti i condomini
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
          <h1 className="ap-page-title">{cliente}</h1>
          <p className="ap-page-subtitle">
            POD/PDR: <strong style={{ fontFamily: 'monospace' }}>{podPdr}</strong>
            {adminName && <> · Amministratore: {adminContactId ? <Link href={`/designs/apulia-power/amministratori/${adminContactId}`} style={{ color: 'var(--ap-primary)', textDecoration: 'none' }}>{adminName}</Link> : <strong>{adminName}</strong>}</>}
            {contact.is_switch_out && <> · <span className="ap-pill" data-tone="amber">Switch-out</span></>}
          </p>
        </div>
        <DeleteContactButton
          contactId={id}
          action={deleteCondomino}
          label="Elimina condominio"
          confirmText={`Eliminare il condominio ${cliente} (POD ${podPdr})?\nQuesta azione non si può annullare.`}
        />
      </header>

      {contact.is_switch_out ? (
        <SwitchOutDateField
          contactId={id}
          switchedOutAt={(contact as { switched_out_at?: string | null }).switched_out_at ?? null}
        />
      ) : (
        <PodPaymentField
          contactId={id}
          firstPaymentAt={firstPaymentAt}
          nextDueDate={nextDueDate}
          paidCount={paidCount}
          isDueNow={isDueNow}
          amount={podAmount}
        />
      )}

      <StoreField contactId={id} store={(contact as { store?: string | null }).store ?? null} options={storeOptions} />

      <SettingsTabs
        tabs={[
          {
            id: 'condominio',
            label: 'Condominio',
            content: (
              <CondominoEditor
                contactId={id}
                core={{
                  firstName: contact.first_name ?? '',
                  lastName: contact.last_name ?? '',
                  email: contact.email ?? '',
                  phone: contact.phone ?? '',
                }}
                customFields={cf}
                tags={tags}
                tagSuggestions={tagSuggestions}
                groups={fieldGroups}
                adminOptions={adminOptions}
                currentAdminCode={codiceAmm}
                currentAdminName={adminName}
              />
            ),
          },
          {
            id: 'amministratore',
            label: 'Amministratore',
            content: <AdminInfoPanel info={adminInfo} />,
          },
        ]}
      />
    </div>
  )
}

function AdminInfoPanel({ info }: { info: { id: string; name: string; cf: string; piva: string; phone: string; email: string; compenso: number } | null }) {
  if (!info) {
    return (
      <section className="ap-card ap-card-pad">
        <p style={{ fontSize: 13, color: 'var(--ap-text-faint)' }}>Nessun amministratore associato a questo condominio.</p>
      </section>
    )
  }
  const rows: Array<[string, string]> = [
    ['Nome', info.name],
    ['Codice fiscale', info.cf || '—'],
    ['Partita IVA', info.piva || '—'],
    ['Telefono', info.phone || '—'],
    ['Email', info.email || '—'],
    ['Compenso per POD', info.compenso > 0 ? info.compenso.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }) : '—'],
  ]
  return (
    <section className="ap-card">
      <header style={{ padding: '14px 20px', borderBottom: '1px solid var(--ap-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h2 style={{ fontSize: 14, fontWeight: 800 }}>Dettagli amministratore</h2>
        <Link href={`/designs/apulia-power/amministratori/${info.id}`} style={{ fontSize: 12, color: 'var(--ap-primary)', textDecoration: 'none', fontWeight: 700 }}>Apri scheda →</Link>
      </header>
      <div style={{ padding: '8px 20px' }}>
        <table className="ap-table">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <td style={{ width: 200, color: 'var(--ap-text-muted)', fontSize: 12, fontWeight: 600 }}>{label}</td>
                <td style={{ fontSize: 13 }}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11, color: 'var(--ap-text-faint)', padding: '0 20px 14px', margin: 0 }}>
        Questi dati appartengono all&apos;amministratore e si modificano dalla sua scheda — qui sono in sola lettura.
      </p>
    </section>
  )
}
