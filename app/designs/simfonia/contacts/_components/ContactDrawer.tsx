'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
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
import SegmentedControl from '../../_components/SegmentedControl'
import { sf } from '@/lib/simfonia/ui'

const accentFill = {
  background: 'var(--shell-soft)',
} as const

const TAG_COLORS: Record<string, string> = {
  energia:      'bg-[#fbf4e2] text-[#9a6f1f]',
  telefonia:    'bg-[var(--shell-soft)] text-brand',
  windtre:      'bg-purple-50 text-purple-700',
  wind:         'bg-purple-50 text-purple-700',
  fastweb:      'bg-orange-50 text-orange-700',
  kena:         'bg-violet-50 text-violet-700',
  connettivita: 'bg-teal-50 text-teal-700',
  luce:         'bg-[#fbf4e2] text-[#9a6f1f]',
  gas:          'bg-[#fbf4e2] text-[#9a6f1f]',
}

const CATEGORY_ACCENT: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  telefonia:       { bg: 'bg-[var(--shell-soft)]', border: 'border-[var(--shell-line)]', text: 'text-brand', dot: 'bg-brand' },
  energia:         { bg: 'bg-[#fbf4e2]',   border: 'border-[#eadab5]',   text: 'text-[#9a6f1f]',   dot: 'bg-[#d7aa45]' },
  connettivita:    { bg: 'bg-[#edf7f1]', border: 'border-[#d7e8de]', text: 'text-[#5f8f76]', dot: 'bg-[#7fb492]' },
  intrattenimento: { bg: 'bg-purple-50',  border: 'border-purple-200',  text: 'text-purple-700',  dot: 'bg-purple-400' },
}
const DEFAULT_ACCENT = { bg: 'bg-[var(--shell-soft)]', border: 'border-[var(--shell-line)]', text: 'text-[var(--foreground)]', dot: 'bg-[var(--shell-muted)]' }

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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
  const customFieldDefMap = useMemo(
    () => new Map(customFieldDefs.map((definition) => [definition.id, definition])),
    [customFieldDefs]
  )

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
  }, [contactId, initialTab, locationId])

  const loadMessages = useCallback(async (showSpinner: boolean) => {
    if (tab !== 'messages' || !contactId) return 0
    if (showSpinner) setMessagesLoading(true)
    try {
      const data = await getConversationMessages(locationId, contactId)
      setMessages(data.messages)
      if (showSpinner || data.messages.length > 0) {
        if (messagesScrollTimeoutRef.current) {
          clearTimeout(messagesScrollTimeoutRef.current)
        }
        messagesScrollTimeoutRef.current = setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
          messagesScrollTimeoutRef.current = null
        }, 50)
      }
      return data.messages.length
    } finally {
      if (showSpinner) setMessagesLoading(false)
    }
  }, [contactId, locationId, tab])

  // Load messages when switching to messages tab + poll every 3s
  useEffect(() => {
    if (tab !== 'messages' || !contactId) return

    void loadMessages(true)
    const interval = setInterval(() => {
      if (document.hidden) return
      void loadMessages(false)
    }, 3000)

    return () => {
      clearInterval(interval)
      if (messagesScrollTimeoutRef.current) {
        clearTimeout(messagesScrollTimeoutRef.current)
        messagesScrollTimeoutRef.current = null
      }
    }
  }, [contactId, loadMessages, tab])

  const fullName = contact
    ? [contact.firstName, contact.lastName].filter(Boolean).join(' ') || '—'
    : ''

  const initials = contact
    ? [contact.firstName?.[0], contact.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?'
    : ''

  const customFields = useMemo(
    () => (contact?.customFields ?? []).filter((field) => {
      const value = field.value ?? field.field_value ?? field.fieldValue ?? ''
      return value !== ''
    }),
    [contact?.customFields]
  )

  const infoFieldGroups = useMemo(() => {
    const groups = new Map<string, typeof customFields>()
    const switchOutByCategory = new Map<string, boolean>()
    const alwaysVisible = new Set(['Anagrafica', 'Altro'])

    for (const field of customFields) {
      const definition = customFieldDefMap.get(field.id)
      const { category, displayName } = parseFieldCategory(definition?.name ?? field.name ?? '')
      const groupName = category ?? 'Altro'
      if (isHiddenCategory(groupName)) continue

      if (displayName.toLowerCase().includes('switch out')) {
        const value = field.value ?? field.field_value ?? field.fieldValue ?? ''
        switchOutByCategory.set(groupName, isSwitchOutOn(value))
        continue
      }

      if (!groups.has(groupName)) groups.set(groupName, [])
      groups.get(groupName)!.push(field)
    }

    const allGroups = Array.from(groups.entries())
    return {
      alwaysGroups: allGroups.filter(([groupName]) => alwaysVisible.has(groupName)),
      tabGroups: allGroups.filter(([groupName]) => !alwaysVisible.has(groupName)),
      switchOutByCategory,
    }
  }, [customFieldDefMap, customFields])

  useEffect(() => {
    if (infoFieldGroups.tabGroups.length === 0) {
      if (infoCfTab) setInfoCfTab(null)
      return
    }

    if (!infoCfTab || !infoFieldGroups.tabGroups.some(([groupName]) => groupName === infoCfTab)) {
      setInfoCfTab(infoFieldGroups.tabGroups[0][0])
    }
  }, [infoCfTab, infoFieldGroups.tabGroups])

  const visibleEditFields = useMemo(
    () => filterVisibleFields(customFieldDefs, false),
    [customFieldDefs]
  )

  const anagraficaFields = useMemo(
    () => visibleEditFields.filter((field) => {
      const { category, displayName } = parseFieldCategory(field.name)
      if (!category || !SHARED_CATEGORIES.includes(category)) return false
      return !displayName.toLowerCase().includes('switch out')
    }),
    [visibleEditFields]
  )

  const categoryConfig = useMemo(() => {
    const categories = discoverCategories(customFieldDefs)
    const categoriaField = getCategoriaField(customFieldDefs)
    const selectedLabels = categoriaField ? parseCategoriaValue(editCfValues[categoriaField.id] ?? '') : []

    const dropdownSeen = new Set<string>()
    const dropdownGroups = selectedLabels
      .map((label) => {
        const fields = getDropdownFields(customFieldDefs, label).filter((field) => !dropdownSeen.has(field.id))
        for (const field of fields) dropdownSeen.add(field.id)
        return fields.length > 0 ? { label, fields } : null
      })
      .filter((group): group is { label: string; fields: CustomFieldDef[] } => group !== null)

    const sharedFieldIds = new Set(
      visibleEditFields
        .filter((field) => {
          const { category } = parseFieldCategory(field.name)
          return Boolean(category && SHARED_CATEGORIES.includes(category))
        })
        .map((field) => field.id)
    )

    const categoryGroups = selectedLabels.map((label) => {
      const switchOutField = getFieldsForCategory(customFieldDefs, label).find((field) => {
        const { displayName } = parseFieldCategory(field.name)
        return displayName.toLowerCase().includes('switch out')
      })

      const fields = getFieldsForCategory(visibleEditFields, label).filter((field) => (
        !dropdownSeen.has(field.id) &&
        !sharedFieldIds.has(field.id) &&
        field.id !== switchOutField?.id
      ))

      const categoryTagNames = categoryTags[label] ?? []
      return {
        label,
        fields,
        switchOutField,
        switchOutEnabled: switchOutField ? isSwitchOutOn(editCfValues[switchOutField.id]) : false,
        categoryTagNames,
        selectedTags: editTags.filter((tag) => categoryTagNames.includes(tag)),
        availableCategoryTags: availableTags.filter((tag) => categoryTagNames.includes(tag) && !editTags.includes(tag)),
      }
    })

    return { categories, categoriaField, selectedLabels, dropdownGroups, categoryGroups }
  }, [availableTags, categoryTags, customFieldDefs, editCfValues, editTags, visibleEditFields])

  useEffect(() => {
    if (categoryConfig.selectedLabels.length === 0) {
      if (editCfTab) setEditCfTab(null)
      return
    }

    if (!editCfTab || !categoryConfig.selectedLabels.includes(editCfTab)) {
      setEditCfTab(categoryConfig.selectedLabels[0])
    }
  }, [categoryConfig.selectedLabels, editCfTab])

  if (!contactId) return null

  function handleSend() {
    if (!message.trim() || !contactId) return
    startSend(async () => {
      const result = await sendMessageToContact(locationId, contactId, message.trim(), 'SMS')
      if (result.error) {
        setSendResult(result.error)
      } else {
        setSendResult('Messaggio inviato')
        setMessage('')
        await loadMessages(true)
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

  const inputClass = sf.inputFull

  const tabs = [
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
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-3xl flex-col bg-[var(--shell-canvas)] shadow-2xl">
        {/* Header */}
        <div className="relative border-b border-[var(--shell-line)] bg-[var(--shell-surface)] px-8 pb-5 pt-6">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-xl text-[var(--shell-muted)] transition-colors hover:bg-[var(--shell-soft)] hover:text-[var(--foreground)]"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>

          {loading ? (
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 animate-pulse rounded-2xl bg-[var(--shell-soft)]" />
              <div className="space-y-2">
                <div className="h-5 w-40 animate-pulse rounded-lg bg-[var(--shell-soft)]" />
                <div className="h-3 w-28 animate-pulse rounded-lg bg-[var(--shell-soft)]" />
              </div>
            </div>
          ) : contact ? (
            <div className="flex items-center gap-5">
              {/* Avatar */}
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-sm"
                style={{ background: 'var(--brand)' }}
              >
                {initials}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-xl font-bold text-[var(--foreground)]">{fullName}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--shell-muted)]">
                  {contact.email && (
                    <span className="flex items-center gap-1.5 truncate">
                      <svg className="h-3.5 w-3.5 shrink-0 text-[var(--shell-muted)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" /></svg>
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
            <SegmentedControl
              className="mt-5"
              tablist
              tabIdPrefix="contact-tab"
              ariaLabel="Sezioni contatto"
              stackedIcons
              scrollable
              items={tabs.map((t) => ({ value: t.key, label: t.label, icon: t.icon }))}
              value={tab}
              onChange={setTab}
            />
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--shell-line)] border-t-brand" />
          </div>
        ) : contact ? (
          <div className={`flex-1 ${tab === 'messages' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'}`}>
            {tab === 'info' ? (
              <div className="space-y-5 p-6">
                {/* AI Summary */}
                <div className="rounded-2xl border border-[var(--shell-line)] bg-[var(--shell-surface)] p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-widest text-brand">AI Riepilogo</p>
                    <button
                      type="button"
                      onClick={handleAiSummary}
                      disabled={aiLoading}
                      className="flex items-center gap-1.5 rounded-xl bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:shadow-md disabled:opacity-50"
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
                    <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]">
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
                  const renderFieldGroup = (fields: typeof customFields) => (
                    <div className="divide-y divide-gray-50">
                      {fields.map((field) => {
                        const val = field.value ?? field.field_value ?? field.fieldValue ?? ''
                        const def = customFieldDefMap.get(field.id)
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
                      {infoFieldGroups.alwaysGroups.map(([groupName, fields]) => (
                        <div key={groupName} className="rounded-2xl border border-gray-200/60 bg-white p-5 shadow-sm">
                          <h3 className="mb-3 text-sm font-bold text-gray-800">{groupName}</h3>
                          {renderFieldGroup(fields)}
                        </div>
                      ))}

                      {/* Category tab bar + content */}
                      {infoFieldGroups.tabGroups.length > 0 && (
                        <div className="rounded-2xl border border-gray-200/60 bg-white p-5 shadow-sm space-y-4">
                          {infoFieldGroups.tabGroups.length > 1 && (
                            <SegmentedControl
                              size="sm"
                              ariaLabel="Categorie campi"
                              items={infoFieldGroups.tabGroups.map(([groupName]) => ({
                                value: groupName,
                                label: groupName,
                              }))}
                              value={infoCfTab ?? infoFieldGroups.tabGroups[0][0]}
                              onChange={(v) => setInfoCfTab(v)}
                              scrollable={infoFieldGroups.tabGroups.length > 3}
                              equalWidth={false}
                            />
                          )}

                          {infoFieldGroups.tabGroups
                            .filter(([groupName]) => infoFieldGroups.tabGroups.length <= 1 || groupName === infoCfTab)
                            .map(([groupName, fields]) => (
                            <div key={groupName}>
                              {infoFieldGroups.switchOutByCategory.get(groupName) && (
                                <div className="mb-4 flex items-center gap-2.5 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3">
                                  <span className="text-lg">&#x1F6A9;</span>
                                  <span className="text-sm font-bold text-red-700">Switch Out — {groupName}</span>
                                </div>
                              )}
                              {infoFieldGroups.tabGroups.length <= 1 && (
                                <h3 className="mb-3 text-sm font-bold text-gray-800">{groupName}</h3>
                              )}
                              {renderFieldGroup(fields)}
                              {/* Per-category tags */}
                              {(() => {
                                const associated = categoryTags[groupName] ?? []
                                const catTags = (contact.tags ?? []).filter((tag) => associated.includes(tag))
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
                  return (
                    <div className="space-y-5 rounded-2xl border border-brand/15 bg-white p-6 shadow-sm">
                      {/* Categoria picker with colored pills */}
                      {categoryConfig.categoriaField && (
                        <div>
                          <h3 className="mb-3 text-sm font-bold text-gray-800">Categoria</h3>
                          <div className="grid grid-cols-2 gap-2">
                            {categoryConfig.categories.map((cat) => {
                              const isChecked = categoryConfig.selectedLabels.includes(cat.label)
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
                                        ? categoryConfig.selectedLabels.filter((l) => l !== cat.label)
                                        : [...categoryConfig.selectedLabels, cat.label]
                                      setEditCfValues((p) => ({ ...p, [categoryConfig.categoriaField!.id]: next.join(',') }))
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
                      {categoryConfig.selectedLabels.length > 1 && (
                        <SegmentedControl
                          size="sm"
                          ariaLabel="Categorie in modifica"
                          items={categoryConfig.selectedLabels.map((label) => ({ value: label, label }))}
                          value={editCfTab ?? categoryConfig.selectedLabels[0]}
                          onChange={(v) => setEditCfTab(v)}
                          scrollable={categoryConfig.selectedLabels.length > 3}
                          equalWidth={false}
                        />
                      )}

                      {/* Dropdown fields */}
                      {categoryConfig.dropdownGroups
                        .filter((group) => categoryConfig.selectedLabels.length <= 1 || group.label === editCfTab)
                        .map((group) => (
                        <div key={group.label} className="space-y-4">
                          {categoryConfig.selectedLabels.length <= 1 && categoryConfig.dropdownGroups.length > 0 && (
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
                        if (categoryConfig.selectedLabels.length === 0) return null

                        return categoryConfig.categoryGroups
                          .filter((group) => categoryConfig.selectedLabels.length <= 1 || group.label === editCfTab)
                          .map((group) => {
                            return (
                          <div key={group.label} className="space-y-4 border-t border-gray-100 pt-4">
                            {categoryConfig.selectedLabels.length <= 1 && group.fields.length > 0 && (
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
                              {(group.selectedTags.length > 0 || group.availableCategoryTags.length > 0) && (
                                <div className="flex flex-wrap gap-1.5">
                                  {group.selectedTags.map((tag) => (
                                    <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-0.5 text-xs font-semibold text-white">
                                      {tag}
                                      <button type="button" onClick={() => setEditTags((prev) => prev.filter((t) => t !== tag))} className="ml-0.5 text-current opacity-50 hover:opacity-100">&times;</button>
                                    </span>
                                  ))}
                                  {group.availableCategoryTags.map((tag) => (
                                    <button key={tag} type="button" onClick={() => setEditTags((prev) => [...prev, tag])} className="rounded-full border border-dashed border-gray-300 bg-white px-2.5 py-0.5 text-[11px] font-medium text-gray-500 transition-colors hover:border-brand/40 hover:text-brand">
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
                                  className="flex-1 rounded-xl border border-gray-200/90 bg-white px-3 py-1.5 text-xs outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/15"
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
                              {editTags.filter((tag) => !group.categoryTagNames.includes(tag)).length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {editTags.filter((tag) => !group.categoryTagNames.includes(tag)).map((tag) => (
                                    <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-gray-700 px-2.5 py-0.5 text-xs font-semibold text-white">
                                      {tag}
                                      <button type="button" onClick={() => setEditTags((prev) => prev.filter((t) => t !== tag))} className="ml-0.5 text-current opacity-50 hover:opacity-100">&times;</button>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            {/* Per-category Switch Out toggle */}
                            {group.switchOutField && (
                              <label className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 transition-colors ${group.switchOutEnabled ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                                <input type="checkbox" checked={group.switchOutEnabled} onChange={(e) => setEditCfValues((p) => ({ ...p, [group.switchOutField!.id]: e.target.checked ? 'Si' : 'No' }))} className="sr-only" />
                                <span className={`text-lg ${group.switchOutEnabled ? '' : 'opacity-30'}`}>&#x1F6A9;</span>
                                <div>
                                  <span className={`text-sm font-bold ${group.switchOutEnabled ? 'text-red-700' : 'text-gray-500'}`}>Switch Out</span>
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
                    className={`${sf.btnSave} flex-1 font-bold shadow-sm`}
                    style={accentFill}
                  >
                    {editSaving ? 'Salvataggio…' : 'Salva modifiche'}
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
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-brand" />
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
                                  ? 'rounded-tr-sm bg-brand text-white'
                                  : 'rounded-tl-sm bg-gray-100 text-gray-900'
                              }`}
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
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !sending) { e.preventDefault(); handleSend() } }}
                    placeholder="Scrivi un messaggio..."
                    rows={3}
                    className={`${sf.input} w-full resize-y px-4 py-3 text-sm min-h-[70px] max-h-[160px]`}
                  />
                  <div className="flex items-center justify-end gap-2 mt-2">
                    {message.trim() && (
                      <button onClick={() => setMessage('')} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50">Cancella</button>
                    )}
                    {messages.length > 0 && (
                      <button
                        onClick={async () => {
                          if (!contactId) return
                          const { aiSuggestReply } = await import('@/lib/ai/actions')
                          const result = await aiSuggestReply(locationId, contactId, 'SMS', messages.slice(-10).map((m) => ({ direction: m.direction ?? 'inbound', body: m.body ?? '' })))
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
