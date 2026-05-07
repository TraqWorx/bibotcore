'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Stage { id: string; name: string }
interface Pipeline { id: string; name: string; stages: Stage[] }
interface Opportunity {
  id: string
  name?: string
  pipelineStageId: string
  status?: string
  monetaryValue?: number
  contactId?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  contactTags?: string[]
  updatedAt?: string
}

interface ContactDetail {
  id: string
  ghl_id: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  tags: string[] | null
  custom_fields: Record<string, string> | null
  amministratore_name: string | null
  codice_amministratore: string | null
  pod_pdr: string | null
  comune: string | null
  is_amministratore: boolean
  is_switch_out: boolean
}

function fmtEur(n: number): string {
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
}

export default function OpportunityDrawer({ opp, pipeline, onClose }: { opp: Opportunity; pipeline: Pipeline; onClose: () => void }) {
  const [contact, setContact] = useState<ContactDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!opp.contactId) return
    let cancelled = false
    setLoading(true)
    setErr(null)
    fetch(`/api/apulia/contact-by-ghl/${opp.contactId}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<{ contact: ContactDetail | null }>
      })
      .then((j) => { if (!cancelled) setContact(j.contact) })
      .catch((e) => { if (!cancelled) setErr(e instanceof Error ? e.message : 'failed') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [opp.contactId])

  // Close on Esc.
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const stageName = pipeline.stages.find((s) => s.id === opp.pipelineStageId)?.name ?? '—'

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', zIndex: 50 }}
      />
      <aside
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(440px, 100vw)',
          background: 'var(--ap-surface, #fff)',
          borderLeft: '1px solid var(--ap-line)',
          boxShadow: '-12px 0 32px rgba(0,0,0,0.15)',
          zIndex: 51,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <header style={{ padding: '14px 18px', borderBottom: '1px solid var(--ap-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ overflow: 'hidden' }}>
            <strong style={{ fontSize: 14 }}>{opp.contactName ?? opp.name ?? 'Senza nome'}</strong>
            <div style={{ fontSize: 11, color: 'var(--ap-text-muted)' }}>{stageName}</div>
          </div>
          <button onClick={onClose} aria-label="Chiudi" style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--ap-text-muted)' }}>×</button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Section label="Opportunità">
            {opp.name && <Field k="Nome" v={opp.name} />}
            <Field k="Stage" v={stageName} />
            {opp.status && <Field k="Stato" v={opp.status} />}
            {opp.monetaryValue != null && <Field k="Valore" v={fmtEur(opp.monetaryValue)} />}
            {opp.updatedAt && <Field k="Aggiornato" v={new Date(opp.updatedAt).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })} />}
          </Section>

          {opp.contactId && (
            <Section label="Contatto">
              {loading && <div style={{ fontSize: 12, color: 'var(--ap-text-muted)' }}>Caricamento…</div>}
              {err && <div style={{ fontSize: 12, color: 'var(--ap-danger)' }}>{err}</div>}
              {contact && (
                <>
                  {contact.email && <Field k="Email" v={contact.email} />}
                  {contact.phone && <Field k="Telefono" v={contact.phone} />}
                  {contact.pod_pdr && <Field k="POD" v={contact.pod_pdr} mono />}
                  {contact.comune && <Field k="Comune" v={contact.comune} />}
                  {contact.amministratore_name && <Field k="Amministratore" v={contact.amministratore_name} />}
                  {contact.codice_amministratore && <Field k="Cod. Amm." v={contact.codice_amministratore} mono />}
                  {contact.is_amministratore && <span className="ap-pill" data-tone="blue" style={{ fontSize: 10, alignSelf: 'flex-start' }}>Amministratore</span>}
                  {contact.is_switch_out && <span className="ap-pill" data-tone="amber" style={{ fontSize: 10, alignSelf: 'flex-start' }}>Switch-out</span>}
                  {contact.tags && contact.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                      {contact.tags.map((t) => (
                        <span key={t} className="ap-pill" data-tone="gray" style={{ fontSize: 10 }}>{t}</span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </Section>
          )}
        </div>

        <footer style={{ borderTop: '1px solid var(--ap-line)', padding: '12px 18px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {contact && (
            <Link
              href={
                contact.is_amministratore
                  ? `/designs/apulia-power/amministratori/${contact.id}`
                  : `/designs/apulia-power/condomini?q=${encodeURIComponent(contact.pod_pdr ?? contact.email ?? '')}`
              }
              className="ap-btn ap-btn-primary"
              style={{ fontSize: 13 }}
            >
              Apri scheda completa →
            </Link>
          )}
        </footer>
      </aside>
    </>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <h3 style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ap-text-muted)', margin: 0 }}>{label}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</div>
    </section>
  )
}

function Field({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
      <span style={{ color: 'var(--ap-text-muted)' }}>{k}</span>
      <span style={{ color: 'var(--ap-text)', textAlign: 'right', fontFamily: mono ? 'monospace' : undefined, fontWeight: 600 }}>{v}</span>
    </div>
  )
}
