'use client'

import { useState, useTransition } from 'react'
import { getConversationMessages, sendMessage, type ConversationMessage } from '@/app/designs/simfonia/conversations/_actions'
import { FARMACIA_LOCATION_ID } from '@/lib/farmacia/fields'

interface ConvoItem {
  id: string
  contactId: string
  name: string | null
  type: string | null
  lastBody: string | null
  lastDate: string | null
}

export default function ConversationsClient({ conversations }: { conversations: ConvoItem[] }) {
  const [active, setActive] = useState<ConvoItem | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, startLoading] = useTransition()
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')

  function open(c: ConvoItem) {
    setActive(c); setMessages([]); setErr('')
    startLoading(async () => {
      try {
        setMessages(await getConversationMessages(FARMACIA_LOCATION_ID, c.id))
      } catch {
        setErr('Impossibile caricare i messaggi.')
      }
    })
  }

  async function send() {
    if (!active || !draft.trim()) return
    setSending(true); setErr('')
    const type = (active.type && /whatsapp/i.test(active.type)) ? 'TYPE_WHATSAPP' : 'TYPE_PHONE'
    const res = await sendMessage(FARMACIA_LOCATION_ID, active.id, active.contactId, draft.trim(), type)
    setSending(false)
    if (res?.error) { setErr(res.error); return }
    setDraft('')
    open(active)
  }

  return (
    <div className="fc-card" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', minHeight: 480, overflow: 'hidden', padding: 0 }}>
      <div style={{ borderRight: '1px solid var(--fc-line)', overflowY: 'auto', maxHeight: 560 }}>
        {conversations.length === 0 && <div style={{ padding: 16, color: 'var(--fc-text-muted)' }}>Nessuna conversazione.</div>}
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => open(c)}
            style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px',
              border: 'none', borderBottom: '1px solid var(--fc-line)',
              background: active?.id === c.id ? 'var(--fc-blue-soft)' : 'transparent', cursor: 'pointer',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name ?? 'Sconosciuto'}</div>
            <div style={{ fontSize: 12, color: 'var(--fc-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.lastBody ?? '—'}</div>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 560 }}>
        {!active ? (
          <div style={{ margin: 'auto', color: 'var(--fc-text-faint)' }}>Seleziona una conversazione</div>
        ) : (
          <>
            <div style={{ padding: 14, borderBottom: '1px solid var(--fc-line)', fontWeight: 600 }}>{active.name ?? 'Sconosciuto'}</div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {loading && <div style={{ color: 'var(--fc-text-faint)' }}>Caricamento…</div>}
              {!loading && messages.length === 0 && <div style={{ color: 'var(--fc-text-faint)' }}>Nessun messaggio.</div>}
              {messages.map((m) => {
                const out = /out/i.test(m.direction)
                return (
                  <div key={m.id} style={{ alignSelf: out ? 'flex-end' : 'flex-start', maxWidth: '75%', background: out ? 'var(--fc-blue)' : 'var(--fc-bg)', color: out ? 'white' : 'var(--fc-text)', padding: '8px 12px', borderRadius: 12, fontSize: 14 }}>
                    {m.body}
                  </div>
                )
              })}
            </div>
            {err && <div style={{ color: 'var(--fc-danger)', fontSize: 13, padding: '0 14px' }}>{err}</div>}
            <div style={{ display: 'flex', gap: 8, padding: 14, borderTop: '1px solid var(--fc-line)' }}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="Scrivi un messaggio…"
                style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--fc-line-strong)' }}
              />
              <button className="fc-btn-primary" onClick={send} disabled={sending}>{sending ? '…' : 'Invia'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
