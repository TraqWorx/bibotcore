'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { computeTier, type SegmentConfig } from '@/lib/farmacia/segments'
import { FARMACIA_LOCATION_ID } from '@/lib/farmacia/fields'
import { createContact, updateContact, deleteContact, saveNotes, setContactTags, getContactOrders, type ContactOrder } from '../_actions'
import type { ClientiRow } from './ClientiView'

type Tab = 'anagrafica' | 'ordini' | 'conversazioni' | 'note'
function euros(c: number | null) { return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format((c ?? 0) / 100) }

export default function ContactDrawer({ contact, adding, config, onClose }: { contact: ClientiRow | null; adding: boolean; config: SegmentConfig; onClose: () => void }) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('anagrafica')
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState('')
  const [orders, setOrders] = useState<ContactOrder[] | null>(null)
  const [tagText, setTagText] = useState((contact?.tags ?? []).join(', '))
  const [notes, setNotes] = useState(contact?.notes ?? '')

  const tier = contact ? computeTier(contact.orders_count, contact.total_spent_cents, config) : null

  useEffect(() => {
    if (tab === 'ordini' && contact && orders === null) {
      getContactOrders(contact.id).then(setOrders).catch(() => setOrders([]))
    }
  }, [tab, contact, orders])

  function refresh() { router.refresh() }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 40 }} />
      <aside style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(520px, 100%)', background: 'var(--fc-surface)', boxShadow: '-8px 0 32px rgba(0,0,0,0.15)', zIndex: 50, overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>
            {adding ? 'Nuovo cliente' : [contact?.first_name, contact?.last_name].filter(Boolean).join(' ') || contact?.phone_norm || '—'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--fc-text-muted)' }}>✕</button>
        </div>

        {!adding && contact && (
          <>
            <div style={{ display: 'flex', gap: 8, margin: '8px 0 16px', flexWrap: 'wrap' }}>
              {tier && <span className="fc-pill" data-tone={tier.color ?? 'gray'}>{tier.name}</span>}
              {contact.is_conversion && <span className="fc-pill" data-tone="green">conversione</span>}
              <span className="fc-pill" data-tone="gray">LTV {euros(contact.total_spent_cents)}</span>
              <span className="fc-pill" data-tone="gray">{contact.orders_count} ordini</span>
              <span className="fc-pill" data-tone="gray">scontrino {euros(contact.avg_order_cents)}</span>
            </div>
            <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--fc-line)', marginBottom: 16 }}>
              {(['anagrafica', 'ordini', 'conversazioni', 'note'] as Tab[]).map((t) => (
                <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: tab === t ? 700 : 400, borderBottom: tab === t ? '2px solid var(--fc-blue)' : '2px solid transparent', textTransform: 'capitalize' }}>
                  {t === 'note' ? 'Tag & Note' : t}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Anagrafica / create */}
        {(adding || tab === 'anagrafica') && (
          <form
            action={(fd) => start(async () => {
              setMsg('')
              const res = adding ? await createContact(fd) : await updateContact(contact!.id, fd)
              if (res?.error) { setMsg(res.error); return }
              setMsg('Salvato.'); refresh(); if (adding) onClose()
            })}
            style={{ display: 'grid', gap: 10 }}
          >
            <Field name="first_name" label="Nome" def={contact?.first_name ?? ''} />
            <Field name="last_name" label="Cognome" def={contact?.last_name ?? ''} />
            <Field name="phone" label="Telefono" def={contact?.phone_norm ?? ''} />
            <Field name="email" label="Email" def={contact?.email ?? ''} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
              <button className="fc-btn-primary" disabled={pending}>{adding ? 'Crea cliente' : 'Salva modifiche'}</button>
              {!adding && contact && (
                <button
                  type="button"
                  onClick={() => { if (confirm('Eliminare questo cliente? Verrà rimosso anche da GHL.')) start(async () => { await deleteContact(contact.id); refresh(); onClose() }) }}
                  style={{ border: '1px solid var(--fc-danger)', color: 'var(--fc-danger)', background: 'transparent', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}
                >Elimina</button>
              )}
              {msg && <span style={{ fontSize: 13, color: 'var(--fc-text-muted)' }}>{msg}</span>}
            </div>
          </form>
        )}

        {/* Ordini */}
        {!adding && tab === 'ordini' && (
          <div className="fc-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="fc-table" style={{ width: '100%' }}>
              <thead><tr><th>Ordine</th><th>Canale</th><th>Totale</th><th>Data</th></tr></thead>
              <tbody>
                {orders === null && <tr><td colSpan={4} style={{ padding: 12, color: 'var(--fc-text-faint)' }}>Caricamento…</td></tr>}
                {orders?.length === 0 && <tr><td colSpan={4} style={{ padding: 12, color: 'var(--fc-text-muted)' }}>Nessun ordine.</td></tr>}
                {orders?.map((o) => (
                  <tr key={o.id}><td style={{ fontSize: 13 }}>{o.order_ext_id}</td><td>{o.channel}</td><td>{euros(o.total_cents)}</td><td style={{ fontSize: 13 }}>{o.order_date ? new Date(o.order_date).toLocaleDateString('it-IT') : '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Conversazioni */}
        {!adding && tab === 'conversazioni' && contact && <MessageComposer ghlId={contact.ghl_id} />}

        {/* Tag & Note */}
        {!adding && tab === 'note' && contact && (
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <label style={lbl}>Tag (separati da virgola)</label>
              <input value={tagText} onChange={(e) => setTagText(e.target.value)} style={inp} />
              <button className="fc-btn-primary" style={{ marginTop: 8 }} disabled={pending} onClick={() => start(async () => { await setContactTags(contact.id, tagText.split(',')); setMsg('Tag salvati.'); refresh() })}>Salva tag</button>
            </div>
            <div>
              <label style={lbl}>Note</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} style={{ ...inp, resize: 'vertical' }} />
              <button className="fc-btn-primary" style={{ marginTop: 8 }} disabled={pending} onClick={() => start(async () => { await saveNotes(contact.id, notes); setMsg('Note salvate.') })}>Salva note</button>
            </div>
            {msg && <span style={{ fontSize: 13, color: 'var(--fc-text-muted)' }}>{msg}</span>}
          </div>
        )}
      </aside>
    </>
  )
}

function MessageComposer({ ghlId }: { ghlId: string | null }) {
  const [type, setType] = useState('SMS')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')

  if (!ghlId) return <p style={{ color: 'var(--fc-text-muted)', fontSize: 14 }}>Cliente non ancora sincronizzato su GHL — sarà messaggiabile dopo la sincronizzazione.</p>

  async function send() {
    if (!text.trim()) return
    setSending(true); setMsg('')
    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId: FARMACIA_LOCATION_ID, contactId: ghlId, type, message: text.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      setMsg(res.ok ? 'Messaggio inviato.' : (data.error ?? `Errore (${res.status})`))
      if (res.ok) setText('')
    } catch { setMsg('Errore di rete.') } finally { setSending(false) }
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <select value={type} onChange={(e) => setType(e.target.value)} style={inp}>
        <option value="SMS">SMS</option>
        <option value="WhatsApp">WhatsApp</option>
        <option value="Email">Email</option>
      </select>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Scrivi un messaggio…" style={{ ...inp, resize: 'vertical' }} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="fc-btn-primary" onClick={send} disabled={sending}>{sending ? '…' : 'Invia messaggio'}</button>
        <a href="/designs/farmacia-cialdella/conversazioni" style={{ fontSize: 13, color: 'var(--fc-blue)' }}>Apri conversazioni</a>
        {msg && <span style={{ fontSize: 13, color: 'var(--fc-text-muted)' }}>{msg}</span>}
      </div>
    </div>
  )
}

function Field({ name, label, def }: { name: string; label: string; def: string }) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      <input name={name} defaultValue={def} style={inp} />
    </div>
  )
}

const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--fc-line-strong)', fontSize: 14 }
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--fc-text-muted)', marginBottom: 4 }
