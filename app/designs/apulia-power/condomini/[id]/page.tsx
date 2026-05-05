import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { getApuliaSession } from '@/lib/apulia/auth'
import { createAdminClient } from '@/lib/supabase-server'
import { fetchApuliaFieldGroups } from '@/lib/apulia/field-meta'
import { APULIA_FIELD } from '@/lib/apulia/fields'
import CondominoEditor from './_components/CondominoEditor'
import DeleteContactButton from '../../_components/DeleteContactButton'
import { deleteCondomino } from './_actions'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await getApuliaSession()
  if (session.role !== 'owner') redirect('/designs/apulia-power/dashboard')
  const { id } = await params

  const sb = createAdminClient()
  const [{ data: contact }, fieldGroups] = await Promise.all([
    sb.from('apulia_contacts').select('*').eq('id', id).maybeSingle(),
    fetchApuliaFieldGroups(),
  ])
  if (!contact || contact.is_amministratore) notFound()

  const cf = (contact.custom_fields ?? {}) as Record<string, string>
  const tags: string[] = contact.tags ?? []
  const podPdr = (cf[APULIA_FIELD.POD_PDR] as string | undefined) ?? contact.pod_pdr ?? '—'
  const cliente = (cf[APULIA_FIELD.CLIENTE] as string | undefined) ?? contact.cliente ?? contact.first_name ?? '—'
  const codiceAmm = cf[APULIA_FIELD.CODICE_AMMINISTRATORE]
  const adminName = (cf[APULIA_FIELD.AMMINISTRATORE_CONDOMINIO] as string | undefined) ?? contact.amministratore_name

  // Find admin contact id by code (if any) so we can link to it.
  let adminContactId: string | null = null
  if (codiceAmm) {
    const { data: a } = await sb
      .from('apulia_contacts')
      .select('id')
      .eq('is_amministratore', true)
      .eq('codice_amministratore', codiceAmm)
      .maybeSingle()
    adminContactId = a?.id ?? null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Link href="/designs/apulia-power/condomini" style={{ fontSize: 13, color: 'var(--ap-text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, width: 'fit-content' }}>
        ← Tutti i condomini
      </Link>

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
        groups={fieldGroups}
      />
    </div>
  )
}
