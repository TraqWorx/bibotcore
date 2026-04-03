'use client'

import { useEffect, useRef, useState } from 'react'

interface Conversation {
  ghl_id: string
  type: string | null
  contact_name: string | null
  last_message_body: string | null
  last_message_date: string | null
  last_message_direction: string | null
}

interface Message {
  id: string
  body: string
  direction: string
  dateAdded: string
  type?: string
}

const TYPE_LABELS: Record<string, string> = {
  TYPE_PHONE: 'SMS', TYPE_EMAIL: 'Email', TYPE_WHATSAPP: 'WhatsApp',
  TYPE_SMS: 'SMS', TYPE_FB: 'Facebook', TYPE_IG: 'Instagram',
}

function formatTime(d: string): string {
  if (!d) return ''
  const date = new Date(d)
  if (isNaN(date.getTime())) return ''
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
}

export default function PortalMessages({
  locationId,
  contactGhlId: _contactGhlId,
  conversations,
}: {
  locationId: string
  contactGhlId: string
  conversations: Conversation[]
}) {
  const [selectedId, setSelectedId] = useState<string | null>(conversations[0]?.ghl_id ?? null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const selected = conversations.find((c) => c.ghl_id === selectedId)

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false

    async function loadMessages() {
      setLoading(true)
      try {
        const res = await fetch(`/api/portal/messages?locationId=${locationId}&conversationId=${selectedId}`)
        const data = await res.json()
        if (cancelled) return
        setMessages(data.messages ?? [])
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadMessages()
    return () => {
      cancelled = true
    }
  }, [selectedId, locationId])

  if (conversations.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-gray-400">Nessuna conversazione trovata.</p>
      </div>
    )
  }

  return (
    <div className="flex h-[500px] rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      {/* Conversation list */}
      <div className="w-72 shrink-0 border-r border-gray-100 overflow-y-auto">
        {conversations.map((c) => (
          <button
            key={c.ghl_id}
            onClick={() => { setSelectedId(c.ghl_id); setMessages([]) }}
            className={`w-full text-left px-4 py-3 border-b border-gray-50 ${
              selectedId === c.ghl_id ? 'bg-gray-50' : 'hover:bg-gray-50/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-800 truncate">
                {TYPE_LABELS[c.type ?? ''] ?? c.type ?? 'Messaggio'}
              </span>
              <span className="text-[10px] text-gray-400">{formatTime(c.last_message_date ?? '')}</span>
            </div>
            <p className="mt-0.5 text-xs text-gray-500 truncate">{c.last_message_body ?? '—'}</p>
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 flex flex-col">
        <div className="border-b border-gray-100 px-4 py-3">
          <p className="text-sm font-medium text-gray-800">
            {TYPE_LABELS[selected?.type ?? ''] ?? 'Conversazione'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-[#2A00CC]" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-center text-sm text-gray-400 mt-8">Nessun messaggio.</p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                  m.direction === 'outbound'
                    ? 'bg-[#2A00CC] text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                  <p className={`mt-1 text-[10px] ${m.direction === 'outbound' ? 'text-white/50' : 'text-gray-400'}`}>
                    {formatTime(m.dateAdded)}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  )
}
