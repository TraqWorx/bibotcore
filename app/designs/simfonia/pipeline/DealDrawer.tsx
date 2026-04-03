'use client'

import { useState, useEffect, useRef, useTransition, useMemo, useCallback } from 'react'
import {
  getDealData,
  sendMessage,
  updateOpportunity,
  createNote,
  deleteNote,
  updateNote,
  createTask,
  completeTask,
} from './_actions'
import SegmentedControl from '../_components/SegmentedControl'
import { sf } from '@/lib/simfonia/ui'

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
  createdBy?: string
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
  users: { id: string; name: string }[]
}

const USER_COLORS = [
  'var(--brand)', '#e11d48', '#059669', '#d97706', '#7c3aed',
  '#0891b2', '#c026d3', '#dc2626', '#4f46e5', '#0d9488',
]
function getUserColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length]
}

const STATUS_OPTIONS = ['open', 'won', 'lost', 'abandoned']
const STATUS_LABELS: Record<string, string> = {
  open: 'Aperta',
  won: 'Vinta',
  lost: 'Persa',
  abandoned: 'Abbandonata',
}
const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-50 text-blue-700 border-blue-200',
  won: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  lost: 'bg-red-50 text-red-700 border-red-200',
  abandoned: 'bg-gray-100 text-gray-500 border-gray-200',
}

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'details', label: 'Dettagli', icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg> },
  { key: 'messages', label: 'Messaggi', icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" /></svg> },
  { key: 'notes', label: 'Note', icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /></svg> },
  { key: 'tasks', label: 'Attività', icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg> },
  { key: 'activity', label: 'Cronologia', icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg> },
]

function formatDate(d: string) {
  if (!d) return ''
  const date = new Date(d)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatTime(d: string) {
  if (!d) return ''
  const date = new Date(d)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

const inputClass = sf.inputFull

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
  const [saving, startSave] = useTransition()
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Message state
  const [message, setMessage] = useState('')
  const [sending, startSending] = useTransition()
  const [sendError, setSendError] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const emojiRef = useRef<HTMLDivElement>(null)
  const messageInputRef = useRef<HTMLInputElement>(null)

  // Notes state
  const [noteText, setNoteText] = useState('')
  const [savingNote, startSaveNote] = useTransition()
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteBody, setEditingNoteBody] = useState('')
  const [savingEdit, startSavingEdit] = useTransition()
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null)

  // Tasks state
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDue, setTaskDue] = useState('')
  const [savingTask, startSaveTask] = useTransition()

  const load = useCallback(async () => {
    setLoading(true)
    const d = await getDealData(dealId, locationId) as DealData
    setData(d)
    setEditName(d.opportunity?.name ?? '')
    setEditValue(String(d.opportunity?.monetaryValue ?? ''))
    setEditStageId(d.opportunity?.pipelineStageId ?? '')
    setEditStatus(d.opportunity?.status ?? 'open')
    setLoading(false)
  }, [dealId, locationId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (tab === 'messages') {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [tab, data?.messages])

  function handleSaveDetails() {
    if (!data?.opportunity) return
    startSave(async () => {
      setSaveError('')
      setSaveSuccess(false)
      const result = await updateOpportunity(data.opportunity!.id, {
        name: editName,
        monetaryValue: Number(editValue) || 0,
        pipelineStageId: editStageId,
        status: editStatus,
      }, locationId)
      if (result?.error) { setSaveError(result.error); return }
      setSaveSuccess(true)
      await load()
      setTimeout(() => setSaveSuccess(false), 2000)
    })
  }

  function handleSend() {
    if (!message.trim() || !data?.conversation?.id) return
    startSending(async () => {
      setSendError('')
      const result = await sendMessage(data.conversation!.id, message.trim(), locationId, data.contact?.id ?? undefined, data.conversation!.type ?? undefined)
      if (result?.error) { setSendError(result.error); return }
      setMessage('')
      const updated = await getDealData(dealId, locationId)
      setData(updated as DealData)
    })
  }

  function handleAddNote() {
    if (!noteText.trim() || !data?.contact?.id) return
    startSaveNote(async () => {
      await createNote(data.contact!.id!, noteText.trim(), locationId)
      setNoteText('')
      const updated = await getDealData(dealId, locationId)
      setData(updated as DealData)
    })
  }

  function handleDeleteNote(noteId: string) {
    if (!data?.contact?.id) return
    setDeletingNoteId(noteId)
    setData((prev) => prev ? { ...prev, notes: prev.notes.filter((n) => n.id !== noteId) } : prev)
    deleteNote(data.contact.id, noteId, locationId).finally(() => setDeletingNoteId(null))
  }

  function handleSaveEditNote() {
    if (!editingNoteId || !editingNoteBody.trim() || !data?.contact?.id) return
    startSavingEdit(async () => {
      await updateNote(data.contact!.id!, editingNoteId, editingNoteBody.trim(), locationId)
      setData((prev) => prev ? {
        ...prev,
        notes: prev.notes.map((n) => n.id === editingNoteId ? { ...n, body: editingNoteBody.trim() } : n),
      } : prev)
      setEditingNoteId(null)
      setEditingNoteBody('')
    })
  }

  function handleAddTask() {
    if (!taskTitle.trim() || !data?.contact?.id) return
    const title = taskTitle.trim()
    const due = taskDue || undefined
    startSaveTask(async () => {
      const result = await createTask(data.contact!.id!, title, locationId, due)
      if (!result?.error) {
        // Add optimistically to local state
        setData((prev) => prev ? {
          ...prev,
          tasks: [...prev.tasks, { id: `temp-${Date.now()}`, title, dueDate: due, status: 'incompleted' }],
        } : prev)
        setTaskTitle('')
        setTaskDue('')
        // Reload to get real ID from GHL
        setTimeout(async () => {
          const updated = await getDealData(dealId, locationId)
          setData(updated as DealData)
        }, 1000)
      }
    })
  }

  async function handleCompleteTask(taskId: string) {
    if (!data?.contact?.id) return
    setData((prev) =>
      prev
        ? { ...prev, tasks: prev.tasks.map((t) => t.id === taskId ? { ...t, status: 'completed', completed: true } : t) }
        : prev
    )
    await completeTask(data.contact.id, taskId, locationId)
  }

  const contactName = useMemo(
    () => [data?.contact?.firstName, data?.contact?.lastName].filter(Boolean).join(' ') || null,
    [data?.contact?.firstName, data?.contact?.lastName]
  )
  const initials = useMemo(
    () =>
      [data?.contact?.firstName?.[0], data?.contact?.lastName?.[0]].filter(Boolean).join('').toUpperCase() ||
      data?.opportunity?.name?.slice(0, 2).toUpperCase() ||
      '?',
    [data?.contact?.firstName, data?.contact?.lastName, data?.opportunity?.name]
  )
  const statusColor = STATUS_COLORS[editStatus] ?? STATUS_COLORS.open

  const sortedMessages = useMemo(
    () => [...(data?.messages ?? [])].sort((a, b) => new Date(a.dateAdded ?? 0).getTime() - new Date(b.dateAdded ?? 0).getTime()),
    [data?.messages]
  )

  const activityItems = useMemo(
    () =>
      [
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
      ]
        .filter((a) => a.date)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [data?.appointments, data?.messages, data?.opportunity?.createdAt]
  )

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col bg-gray-50/80 shadow-2xl">
        {/* Header */}
        <div className="relative border-b border-gray-200/60 bg-white px-7 pb-5 pt-6">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>

          {loading ? (
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 animate-pulse rounded-2xl bg-gray-100" />
              <div className="space-y-2">
                <div className="h-5 w-40 animate-pulse rounded-lg bg-gray-100" />
                <div className="h-3 w-28 animate-pulse rounded-lg bg-gray-100" />
              </div>
            </div>
          ) : data?.opportunity ? (
            <div className="flex items-center gap-5">
              {/* Avatar */}
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-violet-600 text-lg font-bold text-white shadow-sm"
              >
                {initials}
              </div>
              <div className="min-w-0 pr-10">
                <h2 className="text-xl font-bold text-gray-900 truncate">{data.opportunity.name ?? 'Deal'}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                  {contactName && (
                    <span className="flex items-center gap-1.5">
                      <svg className="h-3.5 w-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
                      {contactName}
                    </span>
                  )}
                  {data.opportunity.monetaryValue != null && data.opportunity.monetaryValue > 0 && (
                    <span className="flex items-center gap-1 font-semibold text-gray-700">
                      € {data.opportunity.monetaryValue.toLocaleString('it-IT')}
                    </span>
                  )}
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusColor}`}>
                    {STATUS_LABELS[data.opportunity.status ?? 'open'] ?? data.opportunity.status}
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {/* Tabs */}
          {!loading && data?.opportunity && (
            <SegmentedControl
              className="mt-6"
              tablist
              tabIdPrefix="deal-tab"
              ariaLabel="Sezioni opportunità"
              stackedIcons
              scrollable
              items={TABS.map((t) => ({ value: t.key, label: t.label, icon: t.icon }))}
              value={tab}
              onChange={setTab}
            />
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-brand" />
          </div>
        ) : data?.opportunity ? (
          <div className={`flex-1 ${tab === 'messages' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'}`}>

            {/* DETAILS TAB */}
            {tab === 'details' && (
              <div className="space-y-5 p-7">
                {/* Form card */}
                <div className="rounded-2xl border border-gray-200/60 bg-white p-5 shadow-sm">
                  <p className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-400">Opportunità</p>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-gray-500">Nome</label>
                      <input className={inputClass} value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-gray-500">Valore (€)</label>
                      <input type="number" className={inputClass} value={editValue} onChange={(e) => setEditValue(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-gray-500">Fase</label>
                        <select className={inputClass} value={editStageId} onChange={(e) => setEditStageId(e.target.value)}>
                          {Object.entries(stageMap).map(([id, name]) => (
                            <option key={id} value={id}>{name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-gray-500">Stato</label>
                        <select className={`${inputClass} capitalize`} value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  {saveError && <p className="mt-3 text-xs font-medium text-red-600">{saveError}</p>}
                  {saveSuccess && <p className="mt-3 text-xs font-medium text-emerald-600">Salvato!</p>}
                  <button
                    type="button"
                    onClick={handleSaveDetails}
                    disabled={saving}
                    className="mt-4 w-full rounded-2xl bg-brand py-2.5 text-sm font-bold text-white transition-colors hover:brightness-110 disabled:opacity-40"
                  >
                    {saving ? 'Salvataggio…' : 'Salva modifiche'}
                  </button>
                </div>

                {/* Contact card */}
                {data.contact && (
                  <div className="rounded-2xl border border-gray-200/60 bg-white p-5 shadow-sm">
                    <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">Contatto</p>
                    <div className="flex items-center gap-4">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-violet-600 text-xs font-bold text-white"
                      >
                        {[data.contact.firstName?.[0], data.contact.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        {contactName && <p className="text-sm font-semibold text-gray-900">{contactName}</p>}
                        {data.contact.email && (
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
                            <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" /></svg>
                            {data.contact.email}
                          </p>
                        )}
                        {data.contact.phone && (
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
                            <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" /></svg>
                            {data.contact.phone}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MESSAGES TAB */}
            {tab === 'messages' && (
              <>
                <div className="flex-1 overflow-y-auto p-6">
                  {!data.conversation ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
                        <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" /></svg>
                      </div>
                      <p className="text-sm font-medium text-gray-400">Nessuna conversazione</p>
                    </div>
                  ) : data.messages.length === 0 ? (
                    <p className="py-10 text-center text-sm text-gray-400">Nessun messaggio.</p>
                  ) : (
                    <div className="space-y-2">
                      {sortedMessages.map((msg) => {
                          const isOutbound = msg.direction !== 'inbound'
                          return (
                            <div key={msg.id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                              <div
                                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                                  isOutbound
                                    ? 'rounded-tr-sm bg-brand text-white'
                                    : 'rounded-tl-sm bg-gray-100 text-gray-900'
                                }`}
                              >
                                <p className="leading-snug whitespace-pre-wrap">{msg.body ?? ''}</p>
                                {msg.dateAdded && (
                                  <p className={`mt-1 text-[10px] ${isOutbound ? 'text-white/50' : 'text-gray-400'}`}>
                                    {formatTime(msg.dateAdded)}
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

                {/* Send input */}
                {data.conversation && (
                  <div className="border-t border-gray-200/60 bg-white p-4">
                    {sendError && <p className="mb-2 text-xs font-medium text-red-600">{sendError}</p>}
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
                              onClick={() => { setMessage((prev) => prev + emoji); setShowEmoji(false); messageInputRef.current?.focus() }}
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
                    </div>
                    <textarea
                      ref={messageInputRef as unknown as React.RefObject<HTMLTextAreaElement>}
                      className={`w-full resize-y min-h-[70px] max-h-[160px] ${inputClass}`}
                      placeholder="Scrivi un messaggio..."
                      value={message}
                      rows={3}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !sending) { e.preventDefault(); handleSend() } }}
                    />
                    <div className="flex items-center justify-end gap-2 mt-2">
                      {message.trim() && (
                        <button onClick={() => setMessage('')} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50">Cancella</button>
                      )}
                      {data.messages.length > 0 && data.contact?.id && (
                        <button
                          onClick={async () => {
                            const { aiSuggestReply } = await import('@/lib/ai/actions')
                            const result = await aiSuggestReply(locationId, data.contact!.id!, data.conversation?.type ?? 'SMS', data.messages.slice(-10).map((m) => ({ direction: m.direction ?? 'inbound', body: m.body ?? '' })))
                            if (result.reply) setMessage(result.reply)
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand/10 text-brand transition-colors hover:bg-brand/15"
                          title="Suggerisci risposta AI"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                        </button>
                      )}
                      <button type="button" onClick={handleSend} disabled={sending || !message.trim()} className="rounded-xl bg-brand px-5 py-1.5 text-sm font-semibold text-white transition-colors hover:brightness-110 disabled:opacity-40">
                        {sending ? '...' : 'Invia'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* NOTES TAB */}
            {tab === 'notes' && (
              <div className="space-y-4 p-7">
                {data.contact?.id && (
                  <div className="rounded-2xl border border-gray-200/60 bg-white p-4 shadow-sm">
                    <textarea
                      rows={3}
                      placeholder="Scrivi una nota..."
                      className={`${inputClass} resize-none`}
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={handleAddNote}
                      disabled={savingNote || !noteText.trim()}
                      className="mt-2 w-full rounded-2xl bg-brand py-2 text-sm font-bold text-white transition-colors hover:brightness-110 disabled:opacity-40"
                    >
                      {savingNote ? 'Salvataggio...' : 'Aggiungi Nota'}
                    </button>
                  </div>
                )}
                {(data.notes ?? []).length === 0 ? (
                  <div className="flex flex-col items-center py-10">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
                      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
                    </div>
                    <p className="text-sm text-gray-400">Nessuna nota.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(data.notes ?? []).map((note) => (
                      <div key={note.id} className="group relative rounded-2xl border border-gray-200/60 bg-white p-4 shadow-sm">
                        {editingNoteId === note.id ? (
                          <>
                            <textarea
                              value={editingNoteBody}
                              onChange={(e) => setEditingNoteBody(e.target.value)}
                              rows={3}
                              className={`${inputClass} resize-none`}
                              autoFocus
                            />
                            <div className="mt-2 flex gap-2">
                              <button
                                type="button"
                                onClick={handleSaveEditNote}
                                disabled={savingEdit || !editingNoteBody.trim()}
                                className="flex-1 rounded-xl bg-brand py-2 text-xs font-bold text-white hover:brightness-110 disabled:opacity-40"
                              >
                                {savingEdit ? '...' : 'Salva'}
                              </button>
                              <button
                                onClick={() => { setEditingNoteId(null); setEditingNoteBody('') }}
                                className="flex-1 rounded-xl border border-gray-200 py-2 text-xs font-medium text-gray-500"
                              >
                                Annulla
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap pr-14">{note.body}</p>
                            <div className="mt-2 flex items-center gap-1.5">
                              {note.dateAdded && (
                                <span className="text-[10px] text-gray-400">{formatDate(note.dateAdded)}</span>
                              )}
                              {note.createdBy && (() => {
                                const author = data?.users?.find((u) => u.id === note.createdBy)
                                if (!author) return null
                                return (
                                  <>
                                    <span className="text-[10px] text-gray-300">&middot;</span>
                                    <span className="text-[10px] font-semibold" style={{ color: getUserColor(note.createdBy!) }}>{author.name}</span>
                                  </>
                                )
                              })()}
                            </div>
                            {/* Edit + Delete */}
                            <div className="absolute right-3 top-3 hidden gap-1 group-hover:flex">
                              <button
                                onClick={() => { setEditingNoteId(note.id); setEditingNoteBody(note.body ?? '') }}
                                className="rounded-lg p-1 text-gray-300 transition-colors hover:bg-blue-50 hover:text-blue-500"
                                title="Modifica"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteNote(note.id)}
                                disabled={deletingNoteId === note.id}
                                className="rounded-lg p-1 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                                title="Elimina"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TASKS TAB */}
            {tab === 'tasks' && (
              <div className="space-y-4 p-7">
                {data.contact?.id && (
                  <div className="rounded-2xl border border-gray-200/60 bg-white p-4 shadow-sm">
                    <input
                      placeholder="Titolo attività..."
                      className={`${inputClass} mb-2`}
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                    />
                    <input
                      type="datetime-local"
                      className={`${inputClass} mb-2`}
                      value={taskDue}
                      onChange={(e) => setTaskDue(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={handleAddTask}
                      disabled={savingTask || !taskTitle.trim()}
                      className="w-full rounded-2xl bg-brand py-2 text-sm font-bold text-white transition-colors hover:brightness-110 disabled:opacity-40"
                    >
                      {savingTask ? 'Creazione...' : 'Aggiungi Attività'}
                    </button>
                  </div>
                )}
                {(data.tasks ?? []).length === 0 ? (
                  <div className="flex flex-col items-center py-10">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
                      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                    </div>
                    <p className="text-sm text-gray-400">Nessuna attività.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(data.tasks ?? []).map((task) => {
                      const done = task.status === 'completed' || task.completed
                      return (
                        <div key={task.id} className="flex items-start gap-3 rounded-2xl border border-gray-200/60 bg-white p-4 shadow-sm">
                          <button
                            onClick={() => !done && handleCompleteTask(task.id)}
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                              done
                                ? 'border-emerald-500 bg-emerald-500'
                                : 'border-gray-300 hover:border-brand/50'
                            }`}
                          >
                            {done && (
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm ${done ? 'line-through text-gray-400' : 'font-medium text-gray-900'}`}>
                              {task.title}
                            </p>
                            {task.dueDate && (
                              <p className="mt-0.5 text-xs text-gray-400">
                                Scadenza: {formatDate(task.dueDate)}
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
              <div className="p-7">
                {activityItems.length === 0 ? (
                  <div className="flex flex-col items-center py-10">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
                      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                    </div>
                    <p className="text-sm text-gray-400">Nessuna attività registrata.</p>
                  </div>
                ) : (
                  <ol className="relative ml-3 border-l-2 border-brand/15">
                    {activityItems.map((item, i) => {
                      const iconBg = item.type === 'message' ? 'var(--brand)' : item.type === 'appointment' ? '#059669' : '#6366f1'
                      return (
                        <li key={i} className="mb-6 ml-6">
                          <div
                            className="absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full border-2 border-white"
                            style={{ background: iconBg }}
                          />
                          <p className="text-sm font-medium text-gray-900">{item.label}</p>
                          {item.body && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{item.body}</p>
                          )}
                          <p className="mt-0.5 text-[10px] text-gray-400">{formatDate(item.date)}</p>
                        </li>
                      )
                    })}
                  </ol>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-gray-400">Opportunità non trovata.</p>
          </div>
        )}
      </div>
    </>
  )
}
