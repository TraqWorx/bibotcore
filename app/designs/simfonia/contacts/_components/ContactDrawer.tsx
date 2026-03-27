'use client'

import { useEffect, useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  getContactDetail,
  sendMessageToContact,
  getConversationMessages,
  updateContact,
  deleteContact,
  type ContactDetail,
  type ConversationMessage,
} from '../_actions'
import {
  isHiddenCategory,
  parseFieldCategory,
  discoverCategories,
  getCategoriaField,
  getDropdownFields,
  getFieldsForCategory,
  filterVisibleFields,
  parseCategoriaValue,
  getSwitchOutField,
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
        // Populate custom field values from contact data
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

  // Load messages when switching to messages tab + poll every 5s
  useEffect(() => {
    if (tab !== 'messages' || !contactId) return
    let cancelled = false

    let prevCount = 0

    function loadMessages(showSpinner: boolean) {
      if (showSpinner) setMessagesLoading(true)
      getConversationMessages(locationId, contactId!).then((data) => {
        if (cancelled) return
        // Only update if we got data — don't clear existing messages on empty poll
        if (data.messages.length > 0 || showSpinner) {
          setMessages(data.messages)
        }
        setConversationId(data.conversationId)
        if (showSpinner) {
          setMessagesLoading(false)
        }
        // Scroll to bottom on first load or when new messages arrive
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
        // Re-fetch messages to show the new one
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

      // Build customFields array for GHL API
      const customFieldValues = Object.entries(editCfValues)
        .filter(([, v]) => v.trim() !== '')
        .map(([key, value]) => ({ id: key, field_value: value }))

      // Only send non-empty optional fields — GHL rejects empty strings for email/phone
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
        // Optimistically update contact state from edit values so info tab reflects changes immediately
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
        // Notify parent list to update the contact row immediately
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

  const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#2A00CC] focus:ring-2 focus:ring-[rgba(42,0,204,0.15)] transition-all'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-gray-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">
            {loading ? 'Caricamento...' : fullName}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            &times;
          </button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[#2A00CC]" />
          </div>
        ) : contact ? (
          <>
            {/* Tabs */}
            <div className="flex border-b border-gray-100 px-6">
              {(['info', 'edit', 'messages'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className="border-b-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors"
                  style={{
                    borderColor: tab === t ? '#2A00CC' : 'transparent',
                    color: tab === t ? '#2A00CC' : '#9ca3af',
                  }}
                >
                  {t === 'info' ? 'Dettagli' : t === 'edit' ? 'Modifica' : 'Messaggi'}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className={`flex-1 ${tab === 'messages' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'}`}>
              {tab === 'info' ? (
                <div className="space-y-5 p-6">
                  {/* Switch Out flag */}
                  {(() => {
                    const soField = getSwitchOutField(customFieldDefs)
                    if (!soField) return null
                    const val = (contact.customFields ?? []).find((f) => f.id === soField.id)
                    const isOn = (val?.value ?? val?.field_value ?? val?.fieldValue ?? '') === 'true'
                    if (!isOn) return null
                    return (
                      <div className="flex items-center gap-2 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-2.5">
                        <span className="text-lg">&#x1F6A9;</span>
                        <span className="text-sm font-bold text-red-700">Switch Out</span>
                      </div>
                    )
                  })()}

                  {/* Basic info */}
                  <div className="space-y-2">
                    {contact.email && (
                      <div className="flex items-center gap-3 text-sm">
                        <span className="w-5 text-center text-gray-400">@</span>
                        <span className="text-gray-700">{contact.email}</span>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center gap-3 text-sm">
                        <span className="w-5 text-center text-gray-400">T</span>
                        <span className="text-gray-700">{contact.phone}</span>
                      </div>
                    )}
                    {contact.companyName && (
                      <div className="flex items-center gap-3 text-sm">
                        <span className="w-5 text-center text-gray-400">B</span>
                        <span className="text-gray-700">{contact.companyName}</span>
                      </div>
                    )}
                    {contact.address1 && (
                      <div className="flex items-center gap-3 text-sm">
                        <span className="w-5 text-center text-gray-400">A</span>
                        <span className="text-gray-700">
                          {contact.address1}{contact.city ? `, ${contact.city}` : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  {(contact.tags ?? []).length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">Tag</p>
                      <div className="flex flex-wrap gap-1.5">
                        {contact.tags!.map((tag) => (
                          <span
                            key={tag}
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              TAG_COLORS[tag.toLowerCase()] ?? 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom fields — grouped by category */}
                  {customFields.length > 0 && (() => {
                    // Build a lookup from field ID to custom field def for display name parsing
                    const defMap = new Map(customFieldDefs.map((d) => [d.id, d]))
                    const soField = getSwitchOutField(customFieldDefs)

                    // Group non-empty fields by their parsed category
                    const groups = new Map<string, typeof customFields>()
                    for (const field of customFields) {
                      // Skip Switch Out — rendered separately above
                      if (soField && field.id === soField.id) continue
                      const def = defMap.get(field.id)
                      const { category } = parseFieldCategory(def?.name ?? field.name ?? '')
                      const key = category ?? 'Altro'

                      // Hide admin-only categories
                      if (isHiddenCategory(key)) continue

                      if (!groups.has(key)) groups.set(key, [])
                      groups.get(key)!.push(field)
                    }

                    return Array.from(groups.entries()).map(([groupName, fields]) => (
                      <div key={groupName}>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
                          {groupName}
                        </p>
                        <div className="divide-y divide-gray-50 rounded-xl border border-gray-100">
                          {fields.map((field) => {
                            const val = field.value ?? field.field_value ?? field.fieldValue ?? ''
                            const def = defMap.get(field.id)
                            const { displayName } = parseFieldCategory(def?.name ?? field.name ?? field.key ?? field.id)
                            return (
                              <div key={field.id} className="flex items-center gap-3 px-4 py-2.5">
                                <span className="w-36 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-gray-400 truncate">
                                  {displayName}
                                </span>
                                <span className="text-sm text-gray-800">{val}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))
                  })()}

                  {/* Opportunities */}
                  {(contact.opportunities ?? []).length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
                        Opportunita
                      </p>
                      <div className="space-y-2">
                        {contact.opportunities!.map((opp) => (
                          <div key={opp.id} className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-gray-800">{opp.name ?? '—'}</p>
                              <p className="text-xs text-gray-400">{opp.stageName}</p>
                            </div>
                            <span className="text-sm font-semibold text-gray-700">
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
                <div className="space-y-4 p-6">
                  {/* Switch Out — red flag toggle */}
                  {(() => {
                    const soField = getSwitchOutField(customFieldDefs)
                    if (!soField) return null
                    const isOn = editCfValues[soField.id] === 'true'
                    return (
                      <label
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 transition-all ${
                          isOn ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isOn}
                          onChange={(e) => setEditCfValues((p) => ({ ...p, [soField.id]: e.target.checked ? 'true' : '' }))}
                          className="sr-only"
                        />
                        <span className={`text-xl ${isOn ? '' : 'opacity-30'}`}>&#x1F6A9;</span>
                        <div>
                          <span className={`text-sm font-bold ${isOn ? 'text-red-700' : 'text-gray-500'}`}>Switch Out</span>
                          <p className="text-[11px] text-gray-400">Segna questo contatto come switch out</p>
                        </div>
                      </label>
                    )
                  })()}

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

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">Business Name</label>
                    <input
                      type="text"
                      className={inputClass}
                      value={editData.companyName ?? ''}
                      onChange={(e) => setEditData((p) => ({ ...p, companyName: e.target.value }))}
                    />
                  </div>

                  {/* Categoria (multi-select checkboxes) + Dropdown fields */}
                  {(() => {
                    const categories = discoverCategories(customFieldDefs)
                    const categoriaField = getCategoriaField(customFieldDefs)
                    const selectedCatLabels = categoriaField
                      ? parseCategoriaValue(editCfValues[categoriaField.id] ?? '')
                      : []
                    // Group dropdown fields by category
                    const globalSeen = new Set<string>()
                    const ddGroups = selectedCatLabels
                      .map((label) => {
                        const fields = getDropdownFields(customFieldDefs, label)
                          .filter((df) => !globalSeen.has(df.id))
                        for (const f of fields) globalSeen.add(f.id)
                        return fields.length > 0 ? { label, fields } : null
                      })
                      .filter((g): g is { label: string; fields: CustomFieldDef[] } => g !== null)

                    return (
                      <div className="space-y-4 border-t border-gray-100 pt-4">
                        {categoriaField && (
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">Categoria</label>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {categories.map((cat) => {
                                const isChecked = selectedCatLabels.includes(cat.label)
                                return (
                                  <label key={cat.slug} className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        const next = isChecked
                                          ? selectedCatLabels.filter((l) => l !== cat.label)
                                          : [...selectedCatLabels, cat.label]
                                        setEditCfValues((p) => ({ ...p, [categoriaField.id]: next.join(',') }))
                                      }}
                                      className="h-4 w-4 rounded border-gray-300 text-[#2A00CC] focus:ring-[#2A00CC]"
                                    />
                                    <span className="text-sm text-gray-700">{cat.label}</span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )}
                        {ddGroups.map((group) => (
                          <div key={group.label} className="space-y-4">
                            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{group.label}</p>
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
                      </div>
                    )
                  })()}

                  {/* Tags */}
                  <div className="space-y-2 border-t border-gray-100 pt-4">
                    <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400">Tag</label>
                    <div className="flex flex-wrap gap-1.5">
                      {editTags.map((tag) => (
                        <span
                          key={tag}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            TAG_COLORS[tag.toLowerCase()] ?? 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => setEditTags((prev) => prev.filter((t) => t !== tag))}
                            className="ml-0.5 text-current opacity-50 hover:opacity-100"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            const t = newTag.trim()
                            if (t && !editTags.includes(t)) {
                              setEditTags((prev) => [...prev, t])
                              setNewTag('')
                            }
                          }
                        }}
                        placeholder="Aggiungi tag..."
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const t = newTag.trim()
                          if (t && !editTags.includes(t)) {
                            setEditTags((prev) => [...prev, t])
                            setNewTag('')
                          }
                        }}
                        className="shrink-0 rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
                        style={{ background: '#2A00CC' }}
                      >
                        +
                      </button>
                    </div>
                    {/* Available tag suggestions — filtered by category */}
                    {(() => {
                      const catField = getCategoriaField(customFieldDefs)
                      const catLabels = catField ? parseCategoriaValue(editCfValues[catField.id] ?? '') : []
                      const associated = Array.from(new Set(catLabels.flatMap((l) => categoryTags[l] ?? [])))
                      const filteredTags = associated.length > 0
                        ? availableTags.filter((t) => associated.includes(t))
                        : []
                      return filteredTags.filter((t) => !editTags.includes(t) && (!newTag || t.toLowerCase().includes(newTag.toLowerCase()))).length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {filteredTags
                          .filter((t) => !editTags.includes(t) && (!newTag || t.toLowerCase().includes(newTag.toLowerCase())))
                          .map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => {
                                setEditTags((prev) => [...prev, tag])
                                setNewTag('')
                              }}
                              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors hover:opacity-80 ${
                                TAG_COLORS[tag.toLowerCase()] ?? 'bg-gray-50 text-gray-500 border-gray-200'
                              }`}
                            >
                              + {tag}
                            </button>
                          ))}
                      </div>
                    ) : null
                    })()}
                  </div>

                  {/* Custom Fields — grouped by category */}
                  {(() => {
                    const catField = getCategoriaField(customFieldDefs)
                    const selectedCatLabels = catField ? parseCategoriaValue(editCfValues[catField.id] ?? '') : []
                    if (selectedCatLabels.length === 0) return null

                    const ddFieldIds = new Set<string>()
                    for (const label of selectedCatLabels) {
                      for (const f of getDropdownFields(customFieldDefs, label)) {
                        ddFieldIds.add(f.id)
                      }
                    }
                    const soField = getSwitchOutField(customFieldDefs)
                    const soId = soField?.id
                    const filtered = filterVisibleFields(customFieldDefs, false)
                    const globalSeen = new Set<string>()

                    const groups = selectedCatLabels
                      .map((label) => {
                        const fields = getFieldsForCategory(filtered, label)
                          .filter((f) => !ddFieldIds.has(f.id) && f.id !== soId && !globalSeen.has(f.id))
                        for (const f of fields) {
                          const { category } = parseFieldCategory(f.name)
                          if (category && category !== label) globalSeen.add(f.id)
                        }
                        return fields.length > 0 ? { label, fields } : null
                      })
                      .filter((g): g is { label: string; fields: CustomFieldDef[] } => g !== null)

                    if (groups.length === 0) return null

                    return groups.map((group) => (
                      <div key={group.label} className="space-y-4 border-t border-gray-100 pt-4">
                        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                          {group.label}
                        </p>
                        {group.fields.map((cf) => {
                          const { displayName } = parseFieldCategory(cf.name)
                          return (
                            <div key={cf.id}>
                              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">
                                {displayName}
                              </label>
                              {cf.dataType === 'CHECKBOX' ? (
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={editCfValues[cf.id] === 'true'}
                                    onChange={(e) => setEditCfValues((p) => ({ ...p, [cf.id]: e.target.checked ? 'true' : '' }))}
                                    className="h-4 w-4 rounded border-gray-300"
                                  />
                                  <span className="text-sm text-gray-600">{displayName}</span>
                                </label>
                              ) : cf.dataType === 'SINGLE_OPTIONS' && cf.picklistOptions?.length ? (
                                <select
                                  className={inputClass}
                                  value={editCfValues[cf.id] ?? ''}
                                  onChange={(e) => setEditCfValues((p) => ({ ...p, [cf.id]: e.target.value }))}
                                >
                                  <option value="">Seleziona...</option>
                                  {cf.picklistOptions.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              ) : cf.dataType === 'LARGE_TEXT' || cf.dataType === 'TEXTAREA' ? (
                                <textarea
                                  className={inputClass}
                                  rows={3}
                                  placeholder={cf.placeholder ?? displayName}
                                  value={editCfValues[cf.id] ?? ''}
                                  onChange={(e) => setEditCfValues((p) => ({ ...p, [cf.id]: e.target.value }))}
                                />
                              ) : (
                                <input
                                  type={cf.dataType === 'NUMBER' || cf.dataType === 'MONETARY' ? 'number' : cf.dataType === 'DATE' ? 'date' : 'text'}
                                  className={inputClass}
                                  placeholder={cf.placeholder ?? displayName}
                                  value={editCfValues[cf.id] ?? ''}
                                  onChange={(e) => setEditCfValues((p) => ({ ...p, [cf.id]: e.target.value }))}
                                />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ))
                  })()}

                  {editResult && (
                    <p className={`text-sm font-medium ${editResult.includes('Salvato') ? 'text-emerald-600' : 'text-red-600'}`}>
                      {editResult}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={handleEditSave}
                    disabled={editSaving}
                    className="w-full rounded-xl py-2.5 text-sm font-bold text-black transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ background: '#00F0FF' }}
                  >
                    {editSaving ? 'Salvataggio...' : 'Salva Modifiche'}
                  </button>

                  {/* Delete */}
                  <div className="border-t border-gray-100 pt-4">
                    {!showDeleteConfirm ? (
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="w-full rounded-xl border border-red-200 py-2.5 text-sm font-semibold text-red-600 transition-all hover:bg-red-50"
                      >
                        Elimina Contatto
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-red-600">
                          Sei sicuro? Questa azione non può essere annullata.
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleDelete}
                            disabled={deleting}
                            className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white transition-all hover:bg-red-700 disabled:opacity-50"
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
                          const body = msg.body || ''
                          if (!body) return null
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
                  <div className="border-t border-gray-100 p-4">
                    {sendResult && (
                      <p className={`mb-2 text-xs font-medium ${sendResult.includes('inviato') ? 'text-green-600' : 'text-red-600'}`}>
                        {sendResult}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !sending && handleSend()}
                        placeholder="Scrivi un messaggio..."
                        className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[#2A00CC] focus:ring-1 focus:ring-[rgba(42,0,204,0.15)]"
                      />
                      <button
                        onClick={handleSend}
                        disabled={sending || !message.trim()}
                        className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-40"
                        style={{ background: '#2A00CC' }}
                      >
                        {sending ? '...' : 'Invia'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-gray-400">Contatto non trovato.</p>
          </div>
        )}
      </div>
    </>
  )
}
