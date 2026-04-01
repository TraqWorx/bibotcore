'use client'

import { useEffect, useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  getContactDetail,
  sendMessageToContact,
  getConversationMessages,
  updateContact,
  deleteContact,
  checkUniqueFieldDuplicates,
  type ContactDetail,
  type ConversationMessage,
} from '../_actions'
import { aiSummarizeContact } from '@/lib/ai/actions'
import {
  isHiddenCategory,
  parseFieldCategory,
  discoverCategories,
  getCategoriaField,
  getDropdownFields,
  getFieldsForCategory,
  filterVisibleFields,
  parseCategoriaValue,
  isSwitchOutOn,
  SHARED_CATEGORIES,
  type CustomFieldDef,
} from '@/lib/utils/categoryFields'

const TAG_COLORS: Record<string, string> = {
  energia:      'bg-amber-50 text-amber-700',
  telefonia:    'bg-blue-50 text-blue-700',
  windtre:      'bg-purple-50 text-purple-700',
  wind:         'bg-purple-50 text-purple-700',
  fastweb:      'bg-orange-50 text-orange-700',
  kena:         'bg-violet-50 text-violet-700',
  connettivita: 'bg-teal-50 text-teal-700',
  luce:         'bg-yellow-50 text-yellow-700',
  gas:          'bg-amber-50 text-amber-800',
}

const CATEGORY_ACCENT: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  telefonia:       { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    dot: 'bg-blue-400' },
  energia:         { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  connettivita:    { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  intrattenimento: { bg: 'bg-purple-50',  border: 'border-purple-200',  text: 'text-purple-700',  dot: 'bg-purple-400' },
}
const DEFAULT_ACCENT = { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', dot: 'bg-gray-400' }

interface Props {
  contactId: string | null
  locationId: string
  customFieldDefs?: CustomFieldDef[]
  availableTags?: string[]
  categoryTags?: Record<string, string[]>
  initialTab?: 'info' | 'edit' | 'messages'
  onClose: () => void
  onContactUpdated?: (contactId: string, data: Record<string, unknown>) => void
}

export default function ContactDrawer({ contactId, locationId, customFieldDefs = [], availableTags = [], categoryTags = {}, initialTab = 'info', onClose, onContactUpdated }: Props) {
  const router = useRouter()
  const [contact, setContact] = useState<ContactDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'info' | 'edit' | 'messages'>(initialTab)
  const [message, setMessage] = useState('')
  const [sending, startSend] = useTransition()
  const [sendResult, setSendResult] = useState<string | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Edit state
  const [editData, setEditData] = useState<Record<string, string>>({})
  const [editCfValues, setEditCfValues] = useState<Record<string, string>>({})
  const [editSaving, startEditSave] = useTransition()
  const [editResult, setEditResult] = useState<string | null>(null)

  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string>>({})
  const [editCfTab, setEditCfTab] = useState<string | null>(null)

  // AI Summary
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  async function handleAiSummary() {
    if (!contactId || aiLoading) return
    setAiLoading(true)
    setAiSummary(null)
    const result = await aiSummarizeContact(locationId, contactId)
    if (result.error) {
      setAiSummary(`Errore: ${result.error}`)
    } else {
      setAiSummary(result.summary ?? null)
    }
    setAiLoading(false)
  }
  const [infoCfTab, setInfoCfTab] = useState<string | null>(null)

  // Tags state
  const [editTags, setEditTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, startDelete] = useTransition()

  useEffect(() => {
    if (!contactId) {
      setContact(null)
      return
    }
    setLoading(true)
    setTab(initialTab)
    setMessage('')
    setSendResult(null)
    setEditResult(null)
    setShowDeleteConfirm(false)
    getContactDetail(locationId, contactId).then((data) => {
      setContact(data)
      if (data) {
        setEditData({
          firstName: data.firstName ?? '',
          lastName: data.lastName ?? '',
          email: data.email ?? '',
          phone: data.phone ?? '',
          companyName: data.companyName ?? '',
        })
        setEditTags(data.tags ?? [])
        const cfMap: Record<string, string> = {}
        for (const cf of data.customFields ?? []) {
          const val = cf.value ?? cf.field_value ?? cf.fieldValue ?? ''
          if (val) cfMap[cf.id] = String(val)
        }
        setEditCfValues(cfMap)
      }
      setLoading(false)
    })
  }, [contactId, locationId])

  // Load messages when switching to messages tab + poll every 3s
  useEffect(() => {
    if (tab !== 'messages' || !contactId) return
    let cancelled = false

    let prevCount = 0

    function loadMessages(showSpinner: boolean) {
      if (showSpinner) setMessagesLoading(true)
      getConversationMessages(locationId, contactId!).then((data) => {
        if (cancelled) return
        if (data.messages.length > 0 || showSpinner) {
          setMessages(data.messages)
        }
        setConversationId(data.conversationId)
        if (showSpinner) {
          setMessagesLoading(false)
        }
        if (showSpinner || data.messages.length > prevCount) {
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        }
        prevCount = data.messages.length
      }).catch(() => {
        if (!cancelled && showSpinner) setMessagesLoading(false)
      })
    }

    loadMessages(true)
    const interval = setInterval(() => loadMessages(false), 3000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [tab, contactId, locationId])

  if (!contactId) return null

  const fullName = contact
    ? [contact.firstName, contact.lastName].filter(Boolean).join(' ') || '—'
    : ''

  const initials = contact
    ? [contact.firstName?.[0], contact.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?'
    : ''

  const customFields = (contact?.customFields ?? []).filter((f) => {
    const val = f.value ?? f.field_value ?? f.fieldValue ?? ''
    return val !== ''
  })

  function handleSend() {
    if (!message.trim() || !contactId) return
    startSend(async () => {
      const result = await sendMessageToContact(locationId, contactId, message.trim(), 'SMS')
      if (result.error) {
        setSendResult(result.error)
      } else {
        setSendResult('Messaggio inviato')
        setMessage('')
        const data = await getConversationMessages(locationId, contactId)
        setMessages(data.messages)
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
          setSendResult(null)
        }, 300)
      }
    })
  }

  function handleEditSave() {
    if (!contactId) return
    startEditSave(async () => {
      setEditResult(null)
      setEditFieldErrors({})

      const customFieldValues = Object.entries(editCfValues)
        .filter(([, v]) => v.trim() !== '')
        .map(([key, value]) => ({ id: key, field_value: value }))

      const uniqueErrors = await checkUniqueFieldDuplicates(
        locationId,
        customFieldValues.map((f) => ({ id: f.id, value: f.field_value })),
        contactId
      )
      if (Object.keys(uniqueErrors).length > 0) {
        setEditFieldErrors(uniqueErrors)
        return
      }

      const payload: Record<string, unknown> = { tags: editTags }
      if (editData.firstName?.trim()) payload.firstName = editData.firstName.trim()
      if (editData.lastName?.trim()) payload.lastName = editData.lastName.trim()
      if (editData.email?.trim()) payload.email = editData.email.trim()
      if (editData.phone?.trim()) payload.phone = editData.phone.trim()
      if (editData.companyName?.trim()) payload.companyName = editData.companyName.trim()
      if (customFieldValues.length > 0) payload.customFields = customFieldValues

      const result = await updateContact(locationId, contactId, payload)
      if (result.error) {
        setEditResult(result.error)
      } else {
        setEditResult('Salvato!')
        setContact((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            firstName: editData.firstName?.trim() || prev.firstName,
            lastName: editData.lastName?.trim() || prev.lastName,
            email: editData.email?.trim() || prev.email,
            phone: editData.phone?.trim() || prev.phone,
            companyName: editData.companyName?.trim() || prev.companyName,
            tags: editTags,
            customFields: Object.entries(editCfValues)
              .filter(([, v]) => v.trim() !== '')
              .map(([id, value]) => {
                const def = customFieldDefs.find((d) => d.id === id)
                return { id, value, field_value: value, fieldValue: value, name: def?.name ?? '', key: def?.fieldKey ?? id }
              }),
          }
        })
        if (onContactUpdated) {
          onContactUpdated(contactId, {
            firstName: editData.firstName?.trim(),
            lastName: editData.lastName?.trim(),
            email: editData.email?.trim(),
            phone: editData.phone?.trim(),
            companyName: editData.companyName?.trim(),
            tags: editTags,
            customFields: Object.entries(editCfValues)
              .filter(([, v]) => v.trim() !== '')
              .map(([id, value]) => {
                const def = customFieldDefs.find((d) => d.id === id)
                return { id, value, field_value: value, fieldValue: value, name: def?.name ?? '', key: def?.fieldKey ?? id }
              }),
          })
        }
        router.refresh()
        setTimeout(() => { setEditResult(null); setTab('info') }, 1500)
      }
    })
  }

  function handleDelete() {
    if (!contactId) return
    startDelete(async () => {
      const result = await deleteContact(locationId, contactId)
      if (result.error) {
        setEditResult(result.error)
        setShowDeleteConfirm(false)
      } else {
        onClose()
        router.refresh()
      }
    })
  }

  const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#2A00CC] focus:ring-2 focus:ring-[rgba(42,0,204,0.15)] transition-colors'

  const TABS = [
    { key: 'info' as const, label: 'Dettagli', icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg> },
    { key: 'edit' as const, label: 'Modifica', icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg> },
    { key: 'messages' as const, label: 'Messaggi', icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" /></svg> },
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-3xl flex-col bg-gray-50/80 shadow-2xl">
        {/* Header */}
        <div className="relative border-b border-gray-200/60 bg-white px-8 pb-5 pt-6">
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
          ) : contact ? (
            <div className="flex items-center gap-5">
              {/* Avatar */}
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-sm"
                style={{ background: 'linear-gradient(135deg, #2A00CC 0%, #5B3AFF 100%)' }}
              >
                {initials}
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-gray-900 truncate">{fullName}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                  {contact.email && (
                    <span className="flex items-center gap-1.5 truncate">
                      <svg className="h-3.5 w-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" /></svg>
                      {contact.email}
                    </span>
                  )}
                  {contact.phone && (
                    <span className="flex items-center gap-1.5">
                      <svg className="h-3.5 w-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" /></svg>
                      {contact.phone}
                    </span>
                  )}
                  {contact.companyName && (
                    <span className="flex items-center gap-1.5">
                      <svg className="h-3.5 w-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>
                      {contact.companyName}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {/* Tabs */}
          {!loading && contact && (
            <div className="mt-5 flex gap-1 rounded-xl bg-gray-100/80 p-1">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                    tab === t.key
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[#2A00CC]" />
          </div>
        ) : contact ? (
          <div className={`flex-1 ${tab === 'messages' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'}`}>
            {tab === 'info' ? (
              <div className="space-y-5 p-6">
                {/* AI Summary */}
                <div className="rounded-2xl border border-[rgba(42,0,204,0.12)] bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-widest text-[#2A00CC]">AI Riepilogo</p>
                    <button
                      onClick={handleAiSummary}
                      disabled={aiLoading}
                      className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#2A00CC] to-[#6366f1] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:shadow-md disabled:opacity-50"
                    >
                      {aiLoading ? (
                        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                        </svg>
                      )}
                      {aiLoading ? 'Generando...' : 'Genera'}
                    </button>
                  </div>
                  {aiSummary && (
                    <div className="mt-3 whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
                      {aiSummary}
                    </div>
                  )}
                </div>

                {/* Address if present */}
                {contact.address1 && (
                  <div className="rounded-2xl border border-gray-200/60 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3 text-sm text-gray-700">
                      <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
                      {contact.address1}{contact.city ? `, ${contact.city}` : ''}
                    </div>
                  </div>
                )}

                {/* Custom fields — Anagrafica/Altro always visible, categories as tabs */}
                {customFields.length > 0 && (() => {
                  const defMap = new Map(customFieldDefs.map((d) => [d.id, d]))
                  const ALWAYS_VISIBLE = ['Anagrafica', 'Altro']

                  const groups = new Map<string, typeof customFields>()
                  for (const field of customFields) {
                    const def = defMap.get(field.id)
                    const { category, displayName } = parseFieldCategory(def?.name ?? field.name ?? '')
                    const key = category ?? 'Altro'
                    if (isHiddenCategory(key)) continue
                    if (displayName.toLowerCase().includes('switch out')) continue
                    if (!groups.has(key)) groups.set(key, [])
                    groups.get(key)!.push(field)
                  }

                  const alwaysGroups = Array.from(groups.entries()).filter(([k]) => ALWAYS_VISIBLE.includes(k))
                  const tabGroups = Array.from(groups.entries()).filter(([k]) => !ALWAYS_VISIBLE.includes(k))

                  if (tabGroups.length > 0 && !infoCfTab) {
                    setTimeout(() => setInfoCfTab(tabGroups[0][0]), 0)
                  }

                  const getSoForCategory = (catName: string) => {
                    for (const field of customFields) {
                      const def = defMap.get(field.id)
                      const { category, displayName } = parseFieldCategory(def?.name ?? field.name ?? '')
                      if (category === catName && displayName.toLowerCase().includes('switch out')) {
                        const val = field.value ?? field.field_value ?? field.fieldValue ?? ''
                        return isSwitchOutOn(val)
                      }
                    }
                    return false
                  }

                  const getTagsForCategory = (catLabel: string) => {
                    const associated = categoryTags[catLabel] ?? []
                    return (contact.tags ?? []).filter((t) => associated.includes(t))
                  }

                  const renderFieldGroup = (fields: typeof customFields) => (
                    <div className="divide-y divide-gray-50">
                      {fields.map((field) => {
                        const val = field.value ?? field.field_value ?? field.fieldValue ?? ''
                        const def = defMap.get(field.id)
                        const { displayName } = parseFieldCategory(def?.name ?? field.name ?? field.key ?? field.id)
                        return (
                          <div key={field.id} className="flex items-start gap-4 py-3 px-1">
                            <span className="w-32 shrink-0 pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 truncate">
                              {displayName}
                            </span>
                            <span className="text-sm text-gray-800 break-words">{val}</span>
                          </div>
                        )
                      })}
                    </div>
                  )

                  return (
                    <>
                      {/* Always-visible groups (Anagrafica, Altro) */}
                      {alwaysGroups.map(([groupName, fields]) => (
                        <div key={groupName} className="rounded-2xl border border-gray-200/60 bg-white p-5 shadow-sm">
                          <h3 className="mb-3 text-sm font-bold text-gray-800">{groupName}</h3>
                          {renderFieldGroup(fields)}
                        </div>
                      ))}

                      {/* Category tab bar + content */}
                      {tabGroups.length > 0 && (
                        <div className="rounded-2xl border border-gray-200/60 bg-white p-5 shadow-sm space-y-4">
                          {tabGroups.length > 1 && (
                            <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
                              {tabGroups.map(([groupName]) => {
                                const catSlug = groupName.toLowerCase().replace(/\s+/g, '').replace(/à/g, 'a')
                                const accent = CATEGORY_ACCENT[catSlug]
                                return (
                                  <button
                                    key={groupName}
                                    type="button"
                                    onClick={() => setInfoCfTab(groupName)}
                                    className={`flex-1 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                                      infoCfTab === groupName ? 'bg-white shadow-sm' : ''
                                    }`}
                                    style={infoCfTab === groupName ? { color: '#2A00CC' } : { color: '#6B7280' }}
                                  >
                                    {groupName}
                                  </button>
                                )
                              })}
                            </div>
                          )}

                          {tabGroups
                            .filter(([groupName]) => tabGroups.length <= 1 || groupName === infoCfTab)
                            .map(([groupName, fields]) => (
                            <div key={groupName}>
                              {getSoForCategory(groupName) && (
                                <div className="mb-4 flex items-center gap-2.5 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3">
                                  <span className="text-lg">&#x1F6A9;</span>
                                  <span className="text-sm font-bold text-red-700">Switch Out — {groupName}</span>
                                </div>
                              )}
                              {tabGroups.length <= 1 && (
                                <h3 className="mb-3 text-sm font-bold text-gray-800">{groupName}</h3>
                              )}
                              {renderFieldGroup(fields)}
                              {/* Per-category tags */}
                              {(() => {
                                const catTags = getTagsForCategory(groupName)
                                if (catTags.length === 0) return null
                                return (
                                  <div className="mt-4 pt-3 border-t border-gray-100">
                                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Tag</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {catTags.map((tag) => (
                                        <span key={tag} className={`rounded-full px-3 py-1 text-xs font-semibold ${TAG_COLORS[tag.toLowerCase()] ?? 'bg-gray-100 text-gray-600'}`}>
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )
                              })()}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )
                })()}

                {/* Opportunities */}
                {(contact.opportunities ?? []).length > 0 && (
                  <div className="rounded-2xl border border-gray-200/60 bg-white p-5 shadow-sm">
                    <h3 className="mb-3 text-sm font-bold text-gray-800">Opportunita</h3>
                    <div className="space-y-2">
                      {contact.opportunities!.map((opp) => (
                        <div key={opp.id} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{opp.name ?? '—'}</p>
                            <p className="text-xs text-gray-400">{opp.stageName}</p>
                          </div>
                          <span className="text-sm font-bold text-gray-700">
                            &euro;{(opp.monetaryValue ?? 0).toLocaleString('it-IT')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            ) : tab === 'edit' ? (
              /* Edit tab */
              <div className="space-y-5 p-6">
                {/* Dati Generali card */}
                <div className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm">
                  <h3 className="mb-4 text-sm font-bold text-gray-800">Dati Generali</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">Nome</label>
                        <input
                          type="text"
                          className={inputClass}
                          value={editData.firstName ?? ''}
                          onChange={(e) => setEditData((p) => ({ ...p, firstName: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">Cognome</label>
                        <input
                          type="text"
                          className={inputClass}
                          value={editData.lastName ?? ''}
                          onChange={(e) => setEditData((p) => ({ ...p, lastName: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">Email</label>
                        <input
                          type="email"
                          className={inputClass}
                          value={editData.email ?? ''}
                          onChange={(e) => setEditData((p) => ({ ...p, email: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">Telefono</label>
                        <input
                          type="tel"
                          className={inputClass}
                          value={editData.phone ?? ''}
                          onChange={(e) => setEditData((p) => ({ ...p, phone: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">Business Name</label>
                      <input
                        type="text"
                        className={inputClass}
                        value={editData.companyName ?? ''}
                        onChange={(e) => setEditData((p) => ({ ...p, companyName: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Anagrafica card */}
                {(() => {
                  const filtered = filterVisibleFields(customFieldDefs, false)
                  const anagraficaFields = filtered.filter((f) => {
                    const { category, displayName } = parseFieldCategory(f.name)
                    if (!category || !SHARED_CATEGORIES.includes(category)) return false
                    if (displayName.toLowerCase().includes('switch out')) return false
                    return true
                  })
                  if (anagraficaFields.length === 0) return null
                  return (
                    <div className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm">
                      <h3 className="mb-4 text-sm font-bold text-gray-800">Anagrafica</h3>
                      <div className="space-y-4">
                        {anagraficaFields.map((cf) => {
                          const { displayName } = parseFieldCategory(cf.name)
                          return (
                            <div key={cf.id}>
                              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">{displayName}</label>
                              {cf.dataType === 'CHECKBOX' ? (
                                <label className="flex items-center gap-2">
                                  <input type="checkbox" checked={editCfValues[cf.id] === 'true'} onChange={(e) => setEditCfValues((p) => ({ ...p, [cf.id]: e.target.checked ? 'true' : '' }))} className="h-4 w-4 rounded border-gray-300" />
                                  <span className="text-sm text-gray-600">{displayName}</span>
                                </label>
                              ) : cf.dataType === 'SINGLE_OPTIONS' && cf.picklistOptions?.length ? (
                                <select className={inputClass} value={editCfValues[cf.id] ?? ''} onChange={(e) => setEditCfValues((p) => ({ ...p, [cf.id]: e.target.value }))}>
                                  <option value="">Seleziona...</option>
                                  {cf.picklistOptions.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                                </select>
                              ) : cf.dataType === 'LARGE_TEXT' || cf.dataType === 'TEXTAREA' ? (
                                <textarea className={inputClass} rows={3} placeholder={cf.placeholder ?? displayName} value={editCfValues[cf.id] ?? ''} onChange={(e) => setEditCfValues((p) => ({ ...p, [cf.id]: e.target.value }))} />
                              ) : (
                                <input type={cf.dataType === 'NUMBER' || cf.dataType === 'MONETARY' ? 'number' : cf.dataType === 'DATE' ? 'date' : 'text'} className={inputClass} placeholder={cf.placeholder ?? displayName} value={editCfValues[cf.id] ?? ''} onChange={(e) => setEditCfValues((p) => ({ ...p, [cf.id]: e.target.value }))} />
                              )}
                              {editFieldErrors[cf.id] && (<p className="mt-1 text-xs font-medium text-red-500">{editFieldErrors[cf.id]}</p>)}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {/* Categoria + Category fields card */}
                {(() => {
                  const categories = discoverCategories(customFieldDefs)
                  const categoriaField = getCategoriaField(customFieldDefs)
                  const selectedCatLabels = categoriaField
                    ? parseCategoriaValue(editCfValues[categoriaField.id] ?? '')
                    : []
                  const globalSeen = new Set<string>()
                  const ddGroups = selectedCatLabels
                    .map((label) => {
                      const fields = getDropdownFields(customFieldDefs, label)
                        .filter((df) => !globalSeen.has(df.id))
                      for (const f of fields) globalSeen.add(f.id)
                      return fields.length > 0 ? { label, fields } : null
                    })
                    .filter((g): g is { label: string; fields: CustomFieldDef[] } => g !== null)

                  if (selectedCatLabels.length > 1 && !editCfTab) {
                    setTimeout(() => setEditCfTab(selectedCatLabels[0]), 0)
                  }

                  return (
                    <div className="rounded-2xl border border-[rgba(42,0,204,0.12)] bg-white p-6 shadow-sm space-y-5">
                      {/* Categoria picker with colored pills */}
                      {categoriaField && (
                        <div>
                          <h3 className="mb-3 text-sm font-bold text-gray-800">Categoria</h3>
                          <div className="grid grid-cols-2 gap-2">
                            {categories.map((cat) => {
                              const isChecked = selectedCatLabels.includes(cat.label)
                              const accent = CATEGORY_ACCENT[cat.slug] ?? DEFAULT_ACCENT
                              return (
                                <label
                                  key={cat.slug}
                                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl border-2 px-3.5 py-2.5 transition-colors ${
                                    isChecked ? `${accent.bg} ${accent.border}` : 'border-gray-200 bg-white hover:border-gray-300'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      const next = isChecked
                                        ? selectedCatLabels.filter((l) => l !== cat.label)
                                        : [...selectedCatLabels, cat.label]
                                      setEditCfValues((p) => ({ ...p, [categoriaField.id]: next.join(',') }))
                                      if (next.length > 0 && !next.includes(editCfTab ?? '')) {
                                        setEditCfTab(next[0])
                                      }
                                    }}
                                    className="sr-only"
                                  />
                                  <span className={`h-2.5 w-2.5 rounded-full transition-colors ${isChecked ? accent.dot : 'bg-gray-300'}`} />
                                  <span className={`text-sm font-semibold ${isChecked ? accent.text : 'text-gray-500'}`}>{cat.label}</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Category tabs */}
                      {selectedCatLabels.length > 1 && (
                        <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
                          {selectedCatLabels.map((label) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() => setEditCfTab(label)}
                              className="flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap"
                              style={editCfTab === label ? { background: '#2A00CC', color: 'white' } : { color: '#6B7280' }}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Dropdown fields */}
                      {ddGroups
                        .filter((g) => selectedCatLabels.length <= 1 || g.label === editCfTab)
                        .map((group) => (
                        <div key={group.label} className="space-y-4">
                          {selectedCatLabels.length <= 1 && ddGroups.length > 0 && (
                            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{group.label}</p>
                          )}
                          {group.fields.map((df) =>
                            df.picklistOptions && df.picklistOptions.length > 0 ? (
                              <div key={df.id}>
                                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">
                                  {parseFieldCategory(df.name).displayName}
                                </label>
                                <select
                                  className={inputClass}
                                  value={editCfValues[df.id] ?? ''}
                                  onChange={(e) => setEditCfValues((p) => ({ ...p, [df.id]: e.target.value }))}
                                >
                                  <option value="">Seleziona...</option>
                                  {df.picklistOptions.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              </div>
                            ) : null
                          )}
                        </div>
                      ))}

                      {/* Category custom fields + tags + Switch Out */}
                      {(() => {
                        const catField = getCategoriaField(customFieldDefs)
                        const catLabels = catField ? parseCategoriaValue(editCfValues[catField.id] ?? '') : []
                        if (catLabels.length === 0) return null

                        const ddFieldIds = new Set<string>()
                        for (const label of catLabels) {
                          for (const f of getDropdownFields(customFieldDefs, label)) ddFieldIds.add(f.id)
                        }
                        const filtered = filterVisibleFields(customFieldDefs, false)
                        const soFieldForCategory = (catLabel: string): CustomFieldDef | undefined =>
                          getFieldsForCategory(customFieldDefs, catLabel).find((f) => {
                            const { displayName } = parseFieldCategory(f.name)
                            return displayName.toLowerCase().includes('switch out')
                          })
                        const soFieldIds = new Set<string>()
                        for (const label of catLabels) {
                          const so = soFieldForCategory(label)
                          if (so) soFieldIds.add(so.id)
                        }
                        const anagraficaFieldIds = new Set(
                          filtered.filter((f) => {
                            const { category } = parseFieldCategory(f.name)
                            return category && SHARED_CATEGORIES.includes(category)
                          }).map((f) => f.id)
                        )

                        const globalSeen2 = new Set<string>()
                        const groups = catLabels
                          .map((label) => {
                            const fields = getFieldsForCategory(filtered, label)
                              .filter((f) => !ddFieldIds.has(f.id) && !soFieldIds.has(f.id) && !anagraficaFieldIds.has(f.id) && !globalSeen2.has(f.id))
                            for (const f of fields) {
                              const { category } = parseFieldCategory(f.name)
                              if (category && category !== label) globalSeen2.add(f.id)
                            }
                            return { label, fields }
                          })

                        return groups
                          .filter((g) => catLabels.length <= 1 || g.label === editCfTab)
                          .map((group) => {
                            const soField = soFieldForCategory(group.label)
                            const soIsOn = soField ? isSwitchOutOn(editCfValues[soField.id]) : false
                            const catTagNames = categoryTags[group.label] ?? []
                            const catSelectedTags = editTags.filter((t) => catTagNames.includes(t))
                            const catAvailableTags = (availableTags ?? []).filter((t) => catTagNames.includes(t) && !editTags.includes(t))
                            return (
                          <div key={group.label} className="space-y-4 border-t border-gray-100 pt-4">
                            {catLabels.length <= 1 && group.fields.length > 0 && (
                              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{group.label}</p>
                            )}
                            {group.fields.map((cf) => {
                              const { displayName } = parseFieldCategory(cf.name)
                              return (
                                <div key={cf.id}>
                                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">{displayName}</label>
                                  {cf.dataType === 'CHECKBOX' ? (
                                    <label className="flex items-center gap-2">
                                      <input type="checkbox" checked={editCfValues[cf.id] === 'true'} onChange={(e) => setEditCfValues((p) => ({ ...p, [cf.id]: e.target.checked ? 'true' : '' }))} className="h-4 w-4 rounded border-gray-300" />
                                      <span className="text-sm text-gray-600">{displayName}</span>
                                    </label>
                                  ) : cf.dataType === 'SINGLE_OPTIONS' && cf.picklistOptions?.length ? (
                                    <select className={inputClass} value={editCfValues[cf.id] ?? ''} onChange={(e) => setEditCfValues((p) => ({ ...p, [cf.id]: e.target.value }))}>
                                      <option value="">Seleziona...</option>
                                      {cf.picklistOptions.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                                    </select>
                                  ) : cf.dataType === 'LARGE_TEXT' || cf.dataType === 'TEXTAREA' ? (
                                    <textarea className={inputClass} rows={3} placeholder={cf.placeholder ?? displayName} value={editCfValues[cf.id] ?? ''} onChange={(e) => setEditCfValues((p) => ({ ...p, [cf.id]: e.target.value }))} />
                                  ) : (
                                    <input type={cf.dataType === 'NUMBER' || cf.dataType === 'MONETARY' ? 'number' : cf.dataType === 'DATE' ? 'date' : 'text'} className={inputClass} placeholder={cf.placeholder ?? displayName} value={editCfValues[cf.id] ?? ''} onChange={(e) => setEditCfValues((p) => ({ ...p, [cf.id]: e.target.value }))} />
                                  )}
                                  {editFieldErrors[cf.id] && (<p className="mt-1 text-xs font-medium text-red-500">{editFieldErrors[cf.id]}</p>)}
                                </div>
                              )
                            })}
                            {/* Per-category tags */}
                            <div className="space-y-2 pt-2">
                              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400">Tag</label>
                              {(catSelectedTags.length > 0 || catAvailableTags.length > 0) && (
                                <div className="flex flex-wrap gap-1.5">
                                  {catSelectedTags.map((tag) => (
                                    <span key={tag} className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: '#2A00CC', color: 'white' }}>
                                      {tag}
                                      <button type="button" onClick={() => setEditTags((prev) => prev.filter((t) => t !== tag))} className="ml-0.5 text-current opacity-50 hover:opacity-100">&times;</button>
                                    </span>
                                  ))}
                                  {catAvailableTags.map((tag) => (
                                    <button key={tag} type="button" onClick={() => setEditTags((prev) => [...prev, tag])} className="rounded-full border border-dashed border-gray-300 bg-white px-2.5 py-0.5 text-[11px] font-medium text-gray-500 transition-colors hover:border-[#2A00CC] hover:text-[#2A00CC]">
                                      + {tag}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {/* Custom new tag input */}
                              <div className="flex gap-1.5">
                                <input
                                  type="text"
                                  value={newTag}
                                  onChange={(e) => setNewTag(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const t = newTag.trim(); if (t && !editTags.includes(t)) { setEditTags((prev) => [...prev, t]); setNewTag('') } } }}
                                  placeholder="Aggiungi tag..."
                                  className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-[#2A00CC] focus:ring-1 focus:ring-[rgba(42,0,204,0.15)] transition-colors"
                                />
                                <button
                                  type="button"
                                  onClick={() => { const t = newTag.trim(); if (t && !editTags.includes(t)) { setEditTags((prev) => [...prev, t]); setNewTag('') } }}
                                  disabled={!newTag.trim()}
                                  className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-40"
                                >
                                  +
                                </button>
                              </div>
                              {/* Show manually added tags (not in category suggestions) */}
                              {editTags.filter((t) => !catTagNames.includes(t)).length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {editTags.filter((t) => !catTagNames.includes(t)).map((tag) => (
                                    <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-gray-700 px-2.5 py-0.5 text-xs font-semibold text-white">
                                      {tag}
                                      <button type="button" onClick={() => setEditTags((prev) => prev.filter((t) => t !== tag))} className="ml-0.5 text-current opacity-50 hover:opacity-100">&times;</button>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            {/* Per-category Switch Out toggle */}
                            {soField && (
                              <label className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 transition-colors ${soIsOn ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                                <input type="checkbox" checked={soIsOn} onChange={(e) => setEditCfValues((p) => ({ ...p, [soField.id]: e.target.checked ? 'Si' : 'No' }))} className="sr-only" />
                                <span className={`text-lg ${soIsOn ? '' : 'opacity-30'}`}>&#x1F6A9;</span>
                                <div>
                                  <span className={`text-sm font-bold ${soIsOn ? 'text-red-700' : 'text-gray-500'}`}>Switch Out</span>
                                  <p className="text-[11px] text-gray-400">{group.label}</p>
                                </div>
                              </label>
                            )}
                          </div>
                            )
                          })
                      })()}
                    </div>
                  )
                })()}

                {/* Save + result */}
                {editResult && (
                  <p className={`text-sm font-medium ${editResult.includes('Salvato') ? 'text-emerald-600' : 'text-red-600'}`}>
                    {editResult}
                  </p>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setTab('info')}
                    className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    onClick={handleEditSave}
                    disabled={editSaving}
                    className="flex-1 rounded-xl py-2.5 text-sm font-bold text-black transition-colors hover:opacity-90 disabled:opacity-50 shadow-sm"
                    style={{ background: '#00F0FF' }}
                  >
                    {editSaving ? 'Salvataggio...' : 'Salva Modifiche'}
                  </button>
                </div>

                {/* Delete */}
                <div className="border-t border-gray-100 pt-4">
                  {!showDeleteConfirm ? (
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full rounded-xl border border-red-200 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                    >
                      Elimina Contatto
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-red-600">
                        Sei sicuro? Questa azione non puo essere annullata.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleDelete}
                          disabled={deleting}
                          className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                        >
                          {deleting ? 'Eliminazione...' : 'Conferma Eliminazione'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(false)}
                          className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                        >
                          Annulla
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            ) : (
              /* Messages tab — full chat */
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto p-6">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-[#2A00CC]" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
                        <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" /></svg>
                      </div>
                      <p className="text-sm text-gray-400">Nessun messaggio.</p>
                      <p className="mt-1 text-xs text-gray-300">Invia il primo messaggio qui sotto.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {messages.map((msg) => {
                        const isOutbound = msg.direction !== 'inbound'
                        const body = msg.body || ''
                        if (!body) return null
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
                              <p className="leading-snug whitespace-pre-wrap">{body}</p>
                              {msg.dateAdded && (
                                <p className={`mt-1 text-[10px] ${isOutbound ? 'text-white/50' : 'text-gray-400'}`}>
                                  {new Date(msg.dateAdded).toLocaleString('it-IT', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
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

                {/* Send message */}
                <div className="border-t border-gray-200/60 bg-white p-5 space-y-2">
                  {sendResult && (
                    <p className={`text-xs font-medium ${sendResult.includes('inviato') ? 'text-green-600' : 'text-red-600'}`}>
                      {sendResult}
                    </p>
                  )}
                  {messages.length > 0 && (
                    <button
                      onClick={async () => {
                        if (!contactId) return
                        const { aiSuggestReply } = await import('@/lib/ai/actions')
                        const result = await aiSuggestReply(locationId, contactId, 'SMS', messages.slice(-10).map((m) => ({ direction: m.direction ?? 'inbound', body: m.body ?? '' })))
                        if (result.reply) setMessage(result.reply)
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-[rgba(42,0,204,0.15)] px-2.5 py-1 text-[11px] font-medium hover:bg-[rgba(42,0,204,0.05)]"
                      style={{ color: '#2A00CC' }}
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                      Suggerisci risposta
                    </button>
                  )}
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !sending && handleSend()}
                      placeholder="Scrivi un messaggio..."
                      className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#2A00CC] focus:ring-2 focus:ring-[rgba(42,0,204,0.15)] transition-colors"
                    />
                    <button
                      onClick={handleSend}
                      disabled={sending || !message.trim()}
                      className="rounded-xl px-5 py-3 text-sm font-semibold text-white transition-colors disabled:opacity-40 shadow-sm"
                      style={{ background: '#2A00CC' }}
                    >
                      {sending ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-gray-400">Contatto non trovato.</p>
          </div>
        )}
      </div>
    </>
  )
}
