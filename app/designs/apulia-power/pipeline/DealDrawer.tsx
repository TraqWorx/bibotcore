'use client'

import { useState, useEffect, useRef } from 'react'
import {
  getDealData,
  sendMessage,
  updateOpportunity,
  createNote,
  createTask,
  completeTask,
} from './_actions'

type Tab = 'details' | 'messages' | 'notes' | 'tasks' | 'activity'

interface Message {
  id: string
  body?: string
  direction?: string
  dateAdded?: string
}

interface Note {
  id: string
  body?: string
  dateAdded?: string
}

interface Task {
  id: string
  title?: string
  dueDate?: string
  status?: string
  completed?: boolean
}

interface Appointment {
  id: string
  title?: string
  startTime?: string
  appointmentStatus?: string
}

interface DealData {
  opportunity: {
    id: string
    name?: string
    monetaryValue?: number
    pipelineStageId?: string
    status?: string
    contactId?: string
    createdAt?: string
  } | null
  contact: {
    id?: string
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
  } | null
  conversation: { id: string; type?: string } | null
  messages: Message[]
  notes: Note[]
  tasks: Task[]
  appointments: Appointment[]
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'details', label: 'Dettagli' },
  { key: 'messages', label: 'Messaggi' },
  { key: 'notes', label: 'Note' },
  { key: 'tasks', label: 'Attività' },
  { key: 'activity', label: 'Cronologia' },
]

const STATUS_OPTIONS = ['open', 'won', 'lost', 'abandoned']
const STATUS_LABELS: Record<string, string> = {
  open: 'Aperta',
  won: 'Vinta',
  lost: 'Persa',
  abandoned: 'Abbandonata',
}

export default function DealDrawer({
  dealId,
  stageMap,
  locationId,
  onClose,
}: {
  dealId: string
  stageMap: Record<string, string>
  locationId: string
  onClose: () => void
}) {
  const [data, setData] = useState<DealData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('details')

  // Details edit state
  const [editName, setEditName] = useState('')
  const [editValue, setEditValue] = useState('')
  const [editStageId, setEditStageId] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Message state
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const emojiRef = useRef<HTMLDivElement>(null)
  const messageInputRef = useRef<HTMLInputElement>(null)

  // Notes state
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  // Tasks state
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDue, setTaskDue] = useState('')
  const [savingTask, setSavingTask] = useState(false)

  async function load() {
    setLoading(true)
    const d = await getDealData(dealId, locationId)
    setData(d as DealData)
    setEditName(d.opportunity?.name ?? '')
    setEditValue(String(d.opportunity?.monetaryValue ?? ''))
    setEditStageId(d.opportunity?.pipelineStageId ?? '')
    setEditStatus(d.opportunity?.status ?? 'open')
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [dealId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === 'messages') {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [tab, data?.messages])

  async function handleSaveDetails() {
    if (!data?.opportunity) return
    setSaving(true)
    setSaveError('')
    const result = await updateOpportunity(data.opportunity.id, {
      name: editName,
      monetaryValue: Number(editValue) || 0,
      pipelineStageId: editStageId,
      status: editStatus,
    }, locationId)
    setSaving(false)
    if (result?.error) { setSaveError(result.error); return }
    await load()
  }

  async function handleSend() {
    if (!message.trim() || !data?.conversation?.id) return
    setSending(true)
    setSendError('')
    const result = await sendMessage(data.conversation.id, message.trim(), locationId, data.contact?.id ?? undefined, data.conversation.type ?? undefined)
    if (result?.error) { setSendError(result.error); setSending(false); return }
    setMessage('')
    const updated = await getDealData(dealId, locationId)
    setData(updated as DealData)
    setSending(false)
  }

  async function handleAddNote() {
    if (!noteText.trim() || !data?.contact?.id) return
    setSavingNote(true)
    await createNote(data.contact.id, noteText.trim(), locationId)
    setNoteText('')
    const updated = await getDealData(dealId, locationId)
    setData(updated as DealData)
    setSavingNote(false)
  }

  async function handleAddTask() {
    if (!taskTitle.trim() || !data?.contact?.id) return
    setSavingTask(true)
    await createTask(data.contact.id, taskTitle.trim(), locationId, taskDue || undefined)
    setTaskTitle('')
    setTaskDue('')
    const updated = await getDealData(dealId, locationId)
    setData(updated as DealData)
    setSavingTask(false)
  }

  async function handleCompleteTask(taskId: string) {
    if (!data?.contact?.id) return
    setData((prev) =>
      prev
        ? {
            ...prev,
            tasks: prev.tasks.map((t) =>
              t.id === taskId ? { ...t, status: 'completed', completed: true } : t
            ),
          }
        : prev
    )
    await completeTask(data.contact.id, taskId, locationId)
  }

  const contactName =
    [data?.contact?.firstName, data?.contact?.lastName].filter(Boolean).join(' ') || null

  // Build activity timeline
  const activityItems = [
    ...(data?.opportunity?.createdAt
      ? [{ type: 'created', date: data.opportunity.createdAt, label: 'Opportunità creata', body: undefined as string | undefined }]
      : []),
    ...(data?.messages ?? []).map((m) => ({
      type: 'message' as const,
      date: m.dateAdded ?? '',
      label: m.direction === 'inbound' ? 'Messaggio dal contatto' : 'Messaggio inviato',
      body: m.body,
    })),
    ...(data?.appointments ?? []).map((a) => ({
      type: 'appointment' as const,
      date: a.startTime ?? '',
      label: a.title ?? 'Appuntamento',
      body: undefined as string | undefined,
    })),
  ].filter((a) => a.date).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return (
    <div className="fixed right-0 top-0 z-50 flex h-full w-[440px] flex-col border-l border-[rgba(42,0,204,0.12)] bg-white shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-gray-900">
            {data?.opportunity?.name ?? 'Deal'}
          </h2>
          {contactName && (
            <p className="text-xs text-gray-400">{contactName}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="ml-3 shrink-0 rounded-lg p-1.5 text-gray-400 transition-all duration-150 ease-out hover:bg-gray-100 hover:text-gray-600"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 px-5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`mr-4 border-b-2 py-2.5 text-xs font-semibold transition-colors ${
              tab === t.key
                ? 'border-[#2A00CC] text-[#2A00CC]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="p-6 text-sm text-gray-400">Caricamento…</p>
        ) : (
          <>
            {/* DETAILS TAB */}
            {tab === 'details' && (
              <div className="space-y-4 p-5">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Nome
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition-all duration-150 focus:ring-1 focus:ring-gray-300"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Valore (€)
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition-all duration-150 focus:ring-1 focus:ring-gray-300"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Fase
                  </label>
                  <select
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition-all duration-150 focus:ring-1 focus:ring-gray-300"
                    value={editStageId}
                    onChange={(e) => setEditStageId(e.target.value)}
                  >
                    {Object.entries(stageMap).map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Stato
                  </label>
                  <select
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm capitalize text-gray-900 outline-none transition-all duration-150 focus:ring-1 focus:ring-gray-300"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
                    ))}
                  </select>
                </div>
                {saveError && <p className="text-xs text-red-600">{saveError}</p>}
                <button
                  onClick={handleSaveDetails}
                  disabled={saving}
                  className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-all duration-150 ease-out hover:opacity-90 disabled:opacity-40"
                  style={{ background: '#2A00CC' }}
                >
                  {saving ? 'Salvataggio…' : 'Salva Modifiche'}
                </button>

                {/* Contact card */}
                {data?.contact && (
                  <div className="rounded-xl border border-gray-200 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Contatto</p>
                    {contactName && <p className="text-sm font-medium text-gray-900">{contactName}</p>}
                    {data.contact.email && <p className="mt-0.5 text-sm text-gray-500">{data.contact.email}</p>}
                    {data.contact.phone && <p className="mt-0.5 text-sm text-gray-500">{data.contact.phone}</p>}
                  </div>
                )}
              </div>
            )}

            {/* MESSAGES TAB */}
            {tab === 'messages' && (
              <div className="space-y-3 p-5">
                {!data?.conversation ? (
                  <p className="text-sm text-gray-400">Nessuna conversazione trovata.</p>
                ) : data.messages.length === 0 ? (
                  <p className="text-sm text-gray-400">Nessun messaggio.</p>
                ) : (
                  data.messages.map((msg) => {
                    const isOutbound = msg.direction !== 'inbound'
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                            isOutbound
                              ? 'rounded-tr-sm text-white'
                              : 'rounded-tl-sm bg-gray-100 text-gray-900'
                          }`}
                          style={isOutbound ? { background: '#2A00CC' } : undefined}
                        >
                          <p className="leading-snug">{msg.body ?? ''}</p>
                          {msg.dateAdded && (
                            <p className={`mt-1 text-xs ${isOutbound ? 'text-gray-400' : 'text-gray-400'}`}>
                              {new Date(msg.dateAdded).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* NOTES TAB */}
            {tab === 'notes' && (
              <div className="space-y-4 p-5">
                {data?.contact?.id && (
                  <div className="space-y-2">
                    <textarea
                      rows={3}
                      placeholder="Scrivi una nota…"
                      className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition-all duration-150 focus:ring-1 focus:ring-gray-300"
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                    />
                    <button
                      onClick={handleAddNote}
                      disabled={savingNote || !noteText.trim()}
                      className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all duration-150 ease-out hover:opacity-90 disabled:opacity-40"
                      style={{ background: '#2A00CC' }}
                    >
                      {savingNote ? 'Salvataggio…' : 'Aggiungi Nota'}
                    </button>
                  </div>
                )}
                {(data?.notes ?? []).length === 0 ? (
                  <p className="text-sm text-gray-400">Nessuna nota.</p>
                ) : (
                  <div className="space-y-3">
                    {(data?.notes ?? []).map((note) => (
                      <div key={note.id} className="rounded-xl border border-gray-200 p-4">
                        <p className="text-sm text-gray-900">{note.body}</p>
                        {note.dateAdded && (
                          <p className="mt-1 text-xs text-gray-400">
                            {new Date(note.dateAdded).toLocaleString()}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TASKS TAB */}
            {tab === 'tasks' && (
              <div className="space-y-4 p-5">
                {data?.contact?.id && (
                  <div className="space-y-2">
                    <input
                      placeholder="Titolo attività…"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition-all duration-150 focus:ring-1 focus:ring-gray-300"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                    />
                    <input
                      type="datetime-local"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition-all duration-150 focus:ring-1 focus:ring-gray-300"
                      value={taskDue}
                      onChange={(e) => setTaskDue(e.target.value)}
                    />
                    <button
                      onClick={handleAddTask}
                      disabled={savingTask || !taskTitle.trim()}
                      className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all duration-150 ease-out hover:opacity-90 disabled:opacity-40"
                      style={{ background: '#2A00CC' }}
                    >
                      {savingTask ? 'Creazione…' : 'Aggiungi Attività'}
                    </button>
                  </div>
                )}
                {(data?.tasks ?? []).length === 0 ? (
                  <p className="text-sm text-gray-400">Nessuna attività.</p>
                ) : (
                  <div className="space-y-2">
                    {(data?.tasks ?? []).map((task) => {
                      const done = task.status === 'completed' || task.completed
                      return (
                        <div
                          key={task.id}
                          className="flex items-start gap-3 rounded-xl border border-gray-200 p-4"
                        >
                          <button
                            onClick={() => !done && handleCompleteTask(task.id)}
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150 ${
                              done
                                ? 'border-green-500 bg-green-500'
                                : 'border-gray-300 hover:border-gray-500'
                            }`}
                          >
                            {done && (
                              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                <path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm ${done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                              {task.title}
                            </p>
                            {task.dueDate && (
                              <p className="mt-0.5 text-xs text-gray-400">
                                Due {new Date(task.dueDate).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ACTIVITY TAB */}
            {tab === 'activity' && (
              <div className="p-5">
                {activityItems.length === 0 ? (
                  <p className="text-sm text-gray-400">Nessuna attività registrata.</p>
                ) : (
                  <ol className="relative border-l border-[rgba(42,0,204,0.15)]">
                    {activityItems.map((item, i) => (
                      <li key={i} className="mb-6 ml-4">
                        <div className="absolute -left-1.5 h-3 w-3 rounded-full border-2 border-white" style={{ background: '#2A00CC' }} />
                        <p className="text-sm font-medium text-gray-900">{item.label}</p>
                        {item.body && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{item.body}</p>
                        )}
                        <p className="mt-0.5 text-xs text-gray-400">
                          {new Date(item.date).toLocaleString()}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Send message input (messages tab only) */}
      {!loading && tab === 'messages' && data?.conversation && (
        <div className="border-t border-gray-200 p-4">
          {sendError && <p className="mb-2 text-xs text-red-600">{sendError}</p>}
          <div className="relative flex gap-2">
            {showEmoji && (
              <div
                ref={emojiRef}
                className="absolute bottom-full mb-2 left-0 z-10 grid grid-cols-8 gap-1 rounded-xl border border-gray-200 bg-white p-2 shadow-lg"
              >
                {['😊','😂','🎉','🔥','❤️','👍','👏','🙏','💪','😎','🤔','😅','✅','💯','⚡','🙌','😍','🥳','💬','📞','👋','😇','🎯','⭐'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setMessage((prev) => prev + emoji)
                      setShowEmoji(false)
                      messageInputRef.current?.focus()
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-base hover:bg-gray-100"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowEmoji((v) => !v)}
              className="shrink-0 rounded-xl border border-gray-200 px-2.5 text-gray-400 transition-colors hover:text-gray-600"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
                <circle cx="5.5" cy="6.5" r="1" fill="currentColor"/>
                <circle cx="10.5" cy="6.5" r="1" fill="currentColor"/>
                <path d="M5 10c.8 1.2 2 1.8 3 1.8s2.2-.6 3-1.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </button>
            <input
              ref={messageInputRef}
              className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-all duration-150 focus:ring-1 focus:ring-gray-300"
              placeholder="Scrivi un messaggio…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !sending && handleSend()}
            />
            <button
              onClick={handleSend}
              disabled={sending || !message.trim()}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all duration-150 ease-out hover:opacity-90 disabled:opacity-40"
              style={{ background: '#2A00CC' }}
            >
              {sending ? '…' : 'Invia'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
