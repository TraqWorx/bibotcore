'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import {
  getConversationMessages,
  sendMessage,
  getConversations,
  type ConversationItem,
  type ConversationMessage,
} from '../_actions'

const TYPE_LABELS: Record<string, string> = {
  TYPE_PHONE: 'SMS',
  TYPE_EMAIL: 'Email',
  TYPE_WHATSAPP: 'WhatsApp',
  TYPE_SMS: 'SMS',
  TYPE_FB: 'Facebook',
  TYPE_IG: 'Instagram',
  TYPE_LIVE_CHAT: 'Live Chat',
}

function formatTime(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) {
    return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
}

function formatMessageTime(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface Props {
  conversations: ConversationItem[]
  locationId: string
}

export default function ConversationInbox({ conversations: initialConversations, locationId }: Props) {
  const [conversations, setConversations] = useState(initialConversations)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [sending, startSend] = useTransition()
  const [sendResult, setSendResult] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const selected = conversations.find((c) => c.id === selectedId)

  // Load messages when conversation selected + poll
  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    let prevCount = 0

    function loadMessages(showSpinner: boolean) {
      if (showSpinner) setMessagesLoading(true)
      getConversationMessages(locationId, selectedId!).then((data) => {
        if (cancelled) return
        if (data.length > 0 || showSpinner) {
          setMessages(data)
        }
        if (showSpinner) setMessagesLoading(false)
        if (showSpinner || data.length > prevCount) {
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        }
        prevCount = data.length
      }).catch(() => {
        if (!cancelled && showSpinner) setMessagesLoading(false)
      })
    }

    loadMessages(true)
    const interval = setInterval(() => loadMessages(false), 5000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [selectedId, locationId])

  // Poll conversation list every 10s
  useEffect(() => {
    const interval = setInterval(() => {
      getConversations(locationId).then((data) => {
        if (data.length > 0) setConversations(data)
      })
    }, 10000)
    return () => clearInterval(interval)
  }, [locationId])

  function handleSend() {
    if (!messageText.trim() || !selectedId || !selected) return
    startSend(async () => {
      const result = await sendMessage(
        locationId,
        selectedId,
        selected.contactId,
        messageText.trim(),
        selected.type
      )
      if (result.error) {
        setSendResult(result.error)
      } else {
        setMessageText('')
        setSendResult(null)
        // Re-fetch messages
        const data = await getConversationMessages(locationId, selectedId)
        setMessages(data)
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      }
    })
  }

  const filtered = searchQuery
    ? conversations.filter((c) =>
        c.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.lastMessageBody.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations

  return (
    <div className="flex flex-1 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      {/* Left — conversation list */}
      <div className="flex w-80 shrink-0 flex-col border-r border-gray-100">
        {/* Search */}
        <div className="border-b border-gray-100 p-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca conversazione..."
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#2A00CC] focus:ring-1 focus:ring-[rgba(42,0,204,0.15)]"
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-400">Nessuna conversazione.</p>
          ) : (
            filtered.map((conv) => (
              <button
                key={conv.id}
                onClick={() => { setSelectedId(conv.id); setMessages([]); setSendResult(null) }}
                className={`flex w-full items-start gap-3 border-b border-gray-50 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                  selectedId === conv.id ? 'bg-[rgba(42,0,204,0.04)]' : ''
                }`}
              >
                {/* Avatar */}
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: conv.unreadCount > 0 ? '#2A00CC' : '#9ca3af' }}
                >
                  {conv.contactName.slice(0, 2).toUpperCase()}
                </div>

                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <p className={`truncate text-sm ${conv.unreadCount > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                      {conv.contactName}
                    </p>
                    <span className="shrink-0 text-[10px] text-gray-400">
                      {formatTime(conv.lastMessageDate)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-xs ${conv.unreadCount > 0 ? 'font-medium text-gray-700' : 'text-gray-400'}`}>
                      {conv.lastMessageDirection === 'outbound' && (
                        <span className="text-gray-300 mr-1">Tu: </span>
                      )}
                      {conv.lastMessageBody || '—'}
                    </p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-medium text-gray-500">
                        {TYPE_LABELS[conv.type] ?? conv.type}
                      </span>
                      {conv.unreadCount > 0 && (
                        <span
                          className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
                          style={{ background: '#2A00CC' }}
                        >
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right — chat */}
      <div className="flex flex-1 flex-col">
        {!selectedId ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-400">Seleziona una conversazione</p>
              <p className="mt-1 text-xs text-gray-300">Scegli dalla lista a sinistra</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ background: '#2A00CC' }}
              >
                {selected?.contactName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{selected?.contactName}</p>
                <p className="text-[10px] text-gray-400">
                  {TYPE_LABELS[selected?.type ?? ''] ?? selected?.type}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5">
              {messagesLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-[#2A00CC]" />
                </div>
              ) : messages.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-400">Nessun messaggio.</p>
              ) : (
                <div className="space-y-2">
                  {messages.map((msg) => {
                    const isOutbound = msg.direction !== 'inbound'
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${
                            isOutbound
                              ? 'rounded-tr-sm text-white'
                              : 'rounded-tl-sm bg-gray-100 text-gray-900'
                          }`}
                          style={isOutbound ? { background: '#2A00CC' } : undefined}
                        >
                          <p className="leading-snug whitespace-pre-wrap">{msg.body}</p>
                          {msg.dateAdded && (
                            <p className={`mt-1 text-[10px] ${isOutbound ? 'text-white/50' : 'text-gray-400'}`}>
                              {formatMessageTime(msg.dateAdded)}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Send */}
            <div className="border-t border-gray-100 p-4">
              {sendResult && (
                <p className="mb-2 text-xs font-medium text-red-600">{sendResult}</p>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !sending && handleSend()}
                  placeholder="Scrivi un messaggio..."
                  className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[#2A00CC] focus:ring-1 focus:ring-[rgba(42,0,204,0.15)]"
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !messageText.trim()}
                  className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-40"
                  style={{ background: '#2A00CC' }}
                >
                  {sending ? '...' : 'Invia'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
