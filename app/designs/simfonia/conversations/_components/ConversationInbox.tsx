'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import {
  getConversationMessages,
  sendMessage,
  getConversations,
  getContactNotes,
  createContactNote,
  deleteContactNote,
  updateContactNote,
  assignConversation,
  type ConversationItem,
  type ConversationMessage,
  type NoteItem,
  type LocationUser,
} from '../_actions'
import { aiSuggestReply } from '@/lib/ai/actions'
import { sf } from '@/lib/simfonia/ui'

/** Deterministic color for a user ID */
const USER_COLORS = [
  'var(--brand)', '#e11d48', '#059669', '#d97706', '#7c3aed',
  '#0891b2', '#c026d3', '#dc2626', '#4f46e5', '#0d9488',
]
function getUserColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length]
}

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

function formatNoteDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface Props {
  conversations: ConversationItem[]
  locationId: string
  users: LocationUser[]
  currentUserEmail?: string
}

export default function ConversationInbox({ conversations: initialConversations, locationId, users, currentUserEmail }: Props) {
  // Resolve current user's GHL user ID from email
  const currentGhlUserId = currentUserEmail
    ? users.find((u) => u.email.toLowerCase() === currentUserEmail.toLowerCase())?.id ?? ''
    : ''
  const [conversations, setConversations] = useState(initialConversations)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [sending, startSend] = useTransition()
  const [sendResult, setSendResult] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [aiSuggesting, setAiSuggesting] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Notes state
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState<NoteItem[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [savingNote, startSaveNote] = useTransition()
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteBody, setEditingNoteBody] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Assignment state
  const [assigning, startAssign] = useTransition()

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

  // Poll conversation list every 10s — preserve local assignedTo overrides
  useEffect(() => {
    const interval = setInterval(() => {
      getConversations(locationId).then((data) => {
        if (data.length > 0) {
          setConversations((prev) => {
            const localAssignments = new Map(prev.map((c) => [c.id, c.assignedTo]))
            return data.map((c) => ({
              ...c,
              assignedTo: c.assignedTo || localAssignments.get(c.id) || '',
            }))
          })
        }
      })
    }, 10000)
    return () => clearInterval(interval)
  }, [locationId])

  // Load notes when conversation changes (always, so count badge shows)
  useEffect(() => {
    let cancelled = false

    async function loadNotes() {
      if (!selected?.contactId) {
        setNotes([])
        setNotesLoading(false)
        return
      }

      setNotesLoading(true)
      try {
        const data = await getContactNotes(locationId, selected.contactId)
        if (!cancelled) setNotes(data)
      } finally {
        if (!cancelled) setNotesLoading(false)
      }
    }

    void loadNotes()
    return () => {
      cancelled = true
    }
  }, [selected?.contactId, locationId])

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
        const data = await getConversationMessages(locationId, selectedId)
        setMessages(data)
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      }
    })
  }

  function handleSaveNote() {
    if (!newNote.trim() || !selected?.contactId) return
    startSaveNote(async () => {
      const result = await createContactNote(locationId, selected!.contactId, newNote.trim(), currentGhlUserId || undefined)
      if (!result.error) {
        setNewNote('')
        const data = await getContactNotes(locationId, selected!.contactId)
        setNotes(data)
      }
    })
  }

  async function handleDeleteNote(noteId: string) {
    if (!selected?.contactId) return
    setDeletingNoteId(noteId)
    const result = await deleteContactNote(locationId, selected.contactId, noteId)
    if (!result.error) {
      setNotes((prev) => prev.filter((n) => n.id !== noteId))
    }
    setDeletingNoteId(null)
  }

  async function handleSaveEditNote() {
    if (!editingNoteId || !editingNoteBody.trim() || !selected?.contactId) return
    setSavingEdit(true)
    const result = await updateContactNote(locationId, selected.contactId, editingNoteId, editingNoteBody.trim())
    if (!result.error) {
      setNotes((prev) => prev.map((n) => n.id === editingNoteId ? { ...n, body: editingNoteBody.trim() } : n))
      setEditingNoteId(null)
      setEditingNoteBody('')
    }
    setSavingEdit(false)
  }

  function handleAssign(userId: string) {
    if (!selectedId) return
    startAssign(async () => {
      await assignConversation(locationId, selectedId!, userId)
      // Update local state
      setConversations((prev) =>
        prev.map((c) => c.id === selectedId ? { ...c, assignedTo: userId } : c)
      )
    })
  }

  const filtered = searchQuery
    ? conversations.filter((c) =>
        c.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.lastMessageBody.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations

  const assignedUser = selected?.assignedTo
    ? users.find((u) => u.id === selected.assignedTo)
    : null

  return (
    <div className={`flex flex-1 min-h-0 overflow-hidden ${sf.inbox}`}>
      {/* Left — conversation list */}
      <div className="flex w-80 shrink-0 flex-col border-r border-gray-100">
        {/* Search */}
        <div className="border-b border-gray-100 p-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca conversazione..."
            className={`${sf.input} w-full bg-gray-50/90 px-3 py-2 text-sm`}
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
                onClick={() => { setSelectedId(conv.id); setMessages([]); setSendResult(null); setShowNotes(false) }}
                className={`flex w-full items-start gap-3 border-b border-gray-50 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                  selectedId === conv.id ? 'bg-brand/5' : ''
                }`}
              >
                {/* Avatar */}
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                    conv.unreadCount > 0 ? 'bg-brand' : 'bg-gray-400'
                  }`}
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
                          className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand px-1.5 text-[10px] font-bold text-white"
                        >
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Show assigned user badge with unique color */}
                  {conv.assignedTo && (() => {
                    const user = users.find((u) => u.id === conv.assignedTo)
                    const color = getUserColor(conv.assignedTo)
                    return (
                      <p className="mt-0.5 truncate text-[10px] font-semibold" style={{ color }}>
                        {user?.name ?? 'Assegnato'}
                      </p>
                    )
                  })()}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right — chat + notes */}
      <div className="flex min-h-0 flex-1 flex-col">
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
            {/* Chat header with assignment + notes toggle */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-xs font-bold text-white"
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

              <div className="flex items-center gap-2">
                {/* User assignment dropdown */}
                <div className="relative">
                  <select
                    value={selected?.assignedTo ?? ''}
                    onChange={(e) => handleAssign(e.target.value)}
                    disabled={assigning}
                    className={`${sf.input} h-8 rounded-xl bg-gray-50/90 px-2 pr-7 text-xs text-gray-600 disabled:opacity-50`}
                  >
                    <option value="">Non assegnato</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                {/* Notes toggle */}
                <button
                  onClick={() => setShowNotes(!showNotes)}
                  className={`flex h-8 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors ${
                    showNotes
                      ? 'border-brand/35 bg-brand/5 text-brand'
                      : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  Note
                  {notes.length > 0 && (
                    <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-white">
                      {notes.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            <div className="relative flex flex-1 overflow-hidden min-h-0">
              {/* Messages area */}
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <div className="flex-1 overflow-y-auto p-5">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-brand" />
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
                                  ? 'rounded-tr-sm bg-brand text-white'
                                  : 'rounded-tl-sm bg-gray-100 text-gray-900'
                              }`}
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
                <div className="border-t border-gray-100 p-4 space-y-2">
                  {sendResult && (
                    <p className="text-xs font-medium text-red-600">{sendResult}</p>
                  )}
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !sending) { e.preventDefault(); handleSend() } }}
                    placeholder="Scrivi un messaggio..."
                    rows={3}
                    className={`${sf.input} w-full resize-y px-4 py-3 text-sm min-h-[70px] max-h-[200px]`}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <div />
                    <div className="flex items-center gap-2">
                      {messageText.trim() && (
                        <button onClick={() => setMessageText('')} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50">Cancella</button>
                      )}
                      {messages.length > 0 && (
                        <button
                          onClick={async () => {
                            if (!selected || aiSuggesting) return
                            setAiSuggesting(true)
                            const result = await aiSuggestReply(locationId, selected.contactId, selected.type, messages.slice(-10).map((m) => ({ direction: m.direction, body: m.body })))
                            if (result.reply) setMessageText(result.reply)
                            if (result.error) setSendResult(result.error)
                            setAiSuggesting(false)
                          }}
                          disabled={aiSuggesting}
                          className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand/10 text-brand transition-colors hover:bg-brand/15 disabled:opacity-40"
                          title="Suggerisci risposta AI"
                        >
                          {aiSuggesting ? (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                          ) : (
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                          )}
                        </button>
                      )}
                      <button onClick={handleSend} disabled={sending || !messageText.trim()} className="rounded-xl bg-brand px-5 py-1.5 text-sm font-semibold text-white transition-colors hover:brightness-110 disabled:opacity-40">
                        {sending ? '...' : 'Invia'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes side panel — absolute overlay on the right */}
              {showNotes && (
                <div className="absolute right-0 top-0 bottom-0 z-10 flex w-72 flex-col border-l border-gray-200 bg-white shadow-lg">
                  <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">Note</h3>
                      <p className="text-[10px] text-gray-400">{selected?.contactName}</p>
                    </div>
                    <button onClick={() => setShowNotes(false)} className="rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-gray-500">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>

                  {/* New note input */}
                  <div className="border-b border-gray-100 p-3">
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Aggiungi una nota..."
                      rows={3}
                      className={`${sf.input} w-full resize-none px-3 py-2 text-xs`}
                    />
                    <button
                      onClick={handleSaveNote}
                      disabled={savingNote || !newNote.trim()}
                      className="mt-1.5 w-full rounded-xl bg-brand py-1.5 text-xs font-semibold text-white transition-colors hover:brightness-110 disabled:opacity-40"
                    >
                      {savingNote ? 'Salvataggio...' : 'Salva Nota'}
                    </button>
                  </div>

                  {/* Notes list */}
                  <div className="flex-1 overflow-y-auto p-3">
                    {notesLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-brand" />
                      </div>
                    ) : notes.length === 0 ? (
                      <p className="py-6 text-center text-xs text-gray-400">Nessuna nota per questo contatto.</p>
                    ) : (
                      <div className="space-y-2">
                        {notes.map((note) => (
                          <div key={note.id} className="group relative rounded-lg border border-gray-100 bg-white p-3">
                            {editingNoteId === note.id ? (
                              <>
                                <textarea
                                  value={editingNoteBody}
                                  onChange={(e) => setEditingNoteBody(e.target.value)}
                                  rows={3}
                                  className={`${sf.input} w-full resize-none px-2 py-1.5 text-xs rounded-lg`}
                                  autoFocus
                                />
                                <div className="mt-1.5 flex gap-1.5">
                                  <button
                                    onClick={handleSaveEditNote}
                                    disabled={savingEdit || !editingNoteBody.trim()}
                                    className="flex-1 rounded-lg bg-brand py-1 text-[10px] font-semibold text-white hover:brightness-110 disabled:opacity-40"
                                  >
                                    {savingEdit ? '...' : 'Salva'}
                                  </button>
                                  <button
                                    onClick={() => { setEditingNoteId(null); setEditingNoteBody('') }}
                                    className="flex-1 rounded border border-gray-200 py-1 text-[10px] font-medium text-gray-500"
                                  >
                                    Annulla
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <p className="text-xs leading-relaxed text-gray-700 whitespace-pre-wrap pr-10">{note.body}</p>
                                <div className="mt-1.5 flex items-center gap-1.5">
                                  {note.createdBy && (() => {
                                    const author = users.find((u) => u.id === note.createdBy)
                                    const color = getUserColor(note.createdBy)
                                    return (
                                      <span className="text-[10px] font-semibold" style={{ color }}>
                                        {author?.name ?? 'Utente'}
                                      </span>
                                    )
                                  })()}
                                  <span className="text-[10px] text-gray-300">{note.createdBy ? '·' : ''}</span>
                                  <span className="text-[10px] text-gray-400">{formatNoteDate(note.dateAdded)}</span>
                                </div>
                                {/* Edit + Delete buttons */}
                                <div className="absolute right-2 top-2 hidden gap-0.5 group-hover:flex">
                                  <button
                                    onClick={() => { setEditingNoteId(note.id); setEditingNoteBody(note.body) }}
                                    className="rounded p-0.5 text-gray-300 transition-colors hover:bg-blue-50 hover:text-blue-500"
                                    title="Modifica nota"
                                  >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteNote(note.id)}
                                    disabled={deletingNoteId === note.id}
                                    className="rounded p-0.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                                    title="Elimina nota"
                                  >
                                    {deletingNoteId === note.id ? (
                                      <div className="h-3.5 w-3.5 animate-spin rounded-full border border-gray-300 border-t-red-500" />
                                    ) : (
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                      </svg>
                                    )}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
