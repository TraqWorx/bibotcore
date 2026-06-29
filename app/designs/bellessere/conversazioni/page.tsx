'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'

interface ConversationItem {
  id: string
  contactId: string
  contactName: string
  type: string
  lastMessageBody: string
  lastMessageDate: string
  lastMessageDirection: string
  unreadCount: number
}

interface Message {
  id: string
  body: string
  direction: 'inbound' | 'outbound'
  dateAdded: string
  type: string
  attachments?: string[]
}

const TYPE_ICON: Record<string, string> = {
  TYPE_PHONE: '📱', TYPE_SMS: '📱', TYPE_EMAIL: '✉️',
  TYPE_WHATSAPP: '💬', TYPE_FB: 'f', TYPE_IG: '📷', TYPE_LIVE_CHAT: '💬',
}

const TYPE_LABEL: Record<string, string> = {
  TYPE_PHONE: 'SMS', TYPE_SMS: 'SMS', TYPE_EMAIL: 'Email',
  TYPE_WHATSAPP: 'WhatsApp', TYPE_FB: 'Facebook', TYPE_IG: 'Instagram',
}

function timeAgo(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const diff = Date.now() - d.getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'adesso'
  if (m < 60) return `${m}m fa`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h fa`
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

function initials(name: string) {
  return name.split(' ').map(p => p[0] ?? '').join('').toUpperCase().slice(0, 2) || '?'
}

export default function ConversazioniPage() {
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ConversationItem | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [msgsLoading, setMsgsLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/conversations?locationId=${BELLESSERE_LOCATION_ID}`)
      .then(r => r.json())
      .then(d => setConversations(d.conversations ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [refreshKey])

  const loadMessages = useCallback(async (conv: ConversationItem) => {
    setMsgsLoading(true)
    setMessages([])
    try {
      const r = await fetch(`/api/bellessere/messages?conversationId=${conv.id}`)
      const d = await r.json()
      setMessages(d.messages ?? [])
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch { /* ignore */ }
    finally { setMsgsLoading(false) }
  }, [])

  useEffect(() => {
    if (selected) loadMessages(selected)
  }, [selected, loadMessages])

  async function send() {
    if (!draft.trim() || !selected || sending) return
    setSending(true)
    const body = draft.trim()
    setDraft('')
    try {
      const res = await fetch('/api/bellessere/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selected.id,
          contactId: selected.contactId,
          message: body,
          type: selected.type,
        }),
      })
      if (!res.ok) { setDraft(body); return }
      await loadMessages(selected)
      setRefreshKey(k => k + 1)
    } catch { setDraft(body) } finally { setSending(false) }
  }

  const filtered = search
    ? conversations.filter(c => c.contactName.toLowerCase().includes(search.toLowerCase()) || c.lastMessageBody.toLowerCase().includes(search.toLowerCase()))
    : conversations

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: 'calc(100vh - 72px)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div className="bs-page-eyebrow">Messaggistica</div>
          <h1 className="bs-page-title">Conversazioni</h1>
        </div>
      </div>

      <div className="bs-card" style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: 0 }}>
        {/* Left: conversation list */}
        <div style={{ width: 320, flexShrink: 0, borderRight: '1px solid var(--bs-line)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--bs-line)' }}>
            <div className="bs-search-wrap">
              <svg className="bs-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className="bs-search-input"
                placeholder="Cerca conversazioni..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--bs-text-faint)', fontSize: 13 }}>Caricamento...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--bs-text-faint)', fontSize: 13 }}>Nessuna conversazione.</div>
            ) : (
              filtered.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => setSelected(conv)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 16px',
                    borderBottom: '1px solid var(--bs-line)', cursor: 'pointer',
                    background: selected?.id === conv.id ? 'var(--bs-gold-tint)' : 'transparent',
                    transition: 'background 0.12s',
                  }}
                >
                  <div className="bs-avatar" style={{ flexShrink: 0 }}>{initials(conv.contactName)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.contactName}</span>
                      <span style={{ fontSize: 11, color: 'var(--bs-text-faint)', flexShrink: 0 }}>{timeAgo(conv.lastMessageDate)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--bs-text-faint)' }}>{TYPE_ICON[conv.type] ?? '💬'}</span>
                      <span style={{ fontSize: 12, color: 'var(--bs-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {conv.lastMessageDirection === 'outbound' ? 'Tu: ' : ''}{conv.lastMessageBody || '—'}
                      </span>
                      {conv.unreadCount > 0 && (
                        <span style={{ background: 'var(--bs-gold)', color: 'var(--bs-black)', fontSize: 10, fontWeight: 800, borderRadius: '100px', padding: '1px 6px', flexShrink: 0 }}>
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: message thread */}
        {!selected ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, color: 'var(--bs-text-faint)' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ opacity: 0.3 }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <div style={{ fontSize: 13 }}>Seleziona una conversazione</div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Thread header */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--bs-line)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <div className="bs-avatar" style={{ width: 36, height: 36, fontSize: 13 }}>{initials(selected.contactName)}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{selected.contactName}</div>
                <div style={{ fontSize: 12, color: 'var(--bs-text-faint)' }}>{TYPE_LABEL[selected.type] ?? selected.type}</div>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {msgsLoading ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bs-text-faint)', fontSize: 13 }}>Caricamento...</div>
              ) : messages.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bs-text-faint)', fontSize: 13 }}>Nessun messaggio.</div>
              ) : (
                messages.map(msg => (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: msg.direction === 'outbound' ? 'flex-end' : 'flex-start',
                      maxWidth: '72%',
                    }}
                  >
                    <div style={{
                      padding: '9px 13px',
                      borderRadius: msg.direction === 'outbound' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      background: msg.direction === 'outbound' ? 'var(--bs-black)' : 'var(--bs-bg)',
                      color: msg.direction === 'outbound' ? 'white' : 'var(--bs-text)',
                      fontSize: 13.5,
                      lineHeight: 1.45,
                      border: msg.direction === 'inbound' ? '1px solid var(--bs-line)' : 'none',
                    }}>
                      {msg.body}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--bs-text-faint)', marginTop: 3, textAlign: msg.direction === 'outbound' ? 'right' : 'left', paddingInline: 4 }}>
                      {new Date(msg.dateAdded).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Compose */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--bs-line)', display: 'flex', gap: 10, flexShrink: 0 }}>
              <input
                ref={inputRef}
                className="bs-input"
                style={{ flex: 1 }}
                placeholder={`Scrivi un messaggio via ${TYPE_LABEL[selected.type] ?? 'SMS'}...`}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              />
              <button
                className="bs-btn-primary"
                onClick={send}
                disabled={!draft.trim() || sending}
                style={{ flexShrink: 0 }}
              >
                {sending ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                    <circle cx="12" cy="12" r="10" strokeDasharray="40 20"/>
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                )}
                Invia
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
