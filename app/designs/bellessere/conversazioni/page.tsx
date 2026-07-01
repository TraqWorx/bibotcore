'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

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
    fetch('/api/bellessere/conversations')
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
    <div className="bs-page-stack-tight" style={{ height: 'calc(100vh - 72px)' }}>
      <div className="bs-page-header" style={{ flexShrink: 0 }}>
        <div className="bs-page-header-start">
          <div className="bs-page-eyebrow">Messaggistica</div>
          <h1 className="bs-page-title">Conversazioni</h1>
          <div className="bs-page-subtitle">Inbox cliente con ricerca, canale, unread count e thread SMS in tempo reale.</div>
        </div>
      </div>

      <div className="bs-card bs-conversation-shell">
        {/* Left: conversation list */}
        <div className="bs-conversation-list">
          <div className="bs-conversation-search">
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

          <div className="bs-conversation-scroll">
            {loading ? (
              <div className="bs-loading-state">Caricamento conversazioni...</div>
            ) : filtered.length === 0 ? (
              <div className="bs-empty-state">Nessuna conversazione.</div>
            ) : (
              filtered.map(conv => (
                <div
                  key={conv.id}
                  className="bs-conversation-row"
                  data-active={selected?.id === conv.id ? 'true' : 'false'}
                  onClick={() => setSelected(conv)}
                >
                  <div className="bs-avatar" style={{ flexShrink: 0 }}>{initials(conv.contactName)}</div>
                  <div className="bs-conversation-main">
                    <div className="bs-conversation-topline">
                      <span className="bs-conversation-name">{conv.contactName}</span>
                      <span className="bs-conversation-time">{timeAgo(conv.lastMessageDate)}</span>
                    </div>
                    <div className="bs-conversation-preview">
                      <span className="bs-channel-pill">{TYPE_LABEL[conv.type] ?? 'Chat'}</span>
                      <span className="bs-preview-text">
                        {conv.lastMessageDirection === 'outbound' ? 'Tu: ' : ''}{conv.lastMessageBody || '—'}
                      </span>
                      {conv.unreadCount > 0 && (
                        <span className="bs-unread-pill">
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
          <div className="bs-thread-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ opacity: 0.3 }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Seleziona una conversazione</div>
          </div>
        ) : (
          <div className="bs-thread">
            {/* Thread header */}
            <div className="bs-thread-header">
              <div className="bs-avatar" style={{ width: 36, height: 36, fontSize: 13 }}>{initials(selected.contactName)}</div>
              <div>
                <div className="bs-thread-name">{selected.contactName}</div>
                <div className="bs-thread-meta">{TYPE_LABEL[selected.type] ?? selected.type}</div>
              </div>
            </div>

            {/* Messages */}
            <div className="bs-message-list">
              {msgsLoading ? (
                <div className="bs-loading-state">Caricamento messaggi...</div>
              ) : messages.length === 0 ? (
                <div className="bs-empty-state">Nessun messaggio.</div>
              ) : (
                messages.map(msg => (
                  <div
                    key={msg.id}
                    className="bs-message-item"
                    data-direction={msg.direction}
                  >
                    <div className="bs-message-bubble">
                      {msg.body}
                    </div>
                    <div className="bs-message-time">
                      {new Date(msg.dateAdded).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Compose */}
            <div className="bs-compose-bar">
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
