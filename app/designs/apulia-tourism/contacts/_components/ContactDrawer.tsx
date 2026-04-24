'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import {
  getContactDetail,
  sendMessageToContact,
  updateContact,
  type ContactDetail,
} from '../_actions'

interface DemoContact {
  id: string
  contactName: string
  email: string | null
  phone: string | null
  city: string | null
  tags: string[]
}

interface Props {
  contactId: string | null
  locationId: string
  onClose: () => void
  onContactUpdated?: () => void
  demoContact?: DemoContact | null
}

export default function ContactDrawer({ contactId, locationId, onClose, onContactUpdated, demoContact }: Props) {
  const [contact, setContact] = useState<ContactDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'info' | 'edit' | 'messages'>('info')

  // Edit state
  const [editData, setEditData] = useState<Record<string, string>>({})
  const [editTags, setEditTags] = useState<string[]>([])
  const [saving, startSave] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)

  // Tag input state
  const [tagInput, setTagInput] = useState('')
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([])
  const [allLocationTags, setAllLocationTags] = useState<string[]>([])
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const tagInputRef = useRef<HTMLInputElement>(null)

  // Message state
  const [message, setMessage] = useState('')
  const [sending, startSend] = useTransition()
  const [sendResult, setSendResult] = useState<string | null>(null)

  // Fetch location tags for autocomplete
  useEffect(() => {
    if (demoContact) {
      setAllLocationTags(['hotel', 'premium', 'tour-operator', 'b&b', 'new', 'restaurant', 'partner'])
      return
    }
    fetch(`/api/ghl/contacts?locationId=${locationId}&limit=1`)
      .catch(() => {})
    // Fetch tags from GHL
    fetch(`/api/ghl/tags?locationId=${locationId}`)
      .then((r) => r.json())
      .then((data) => {
        const tags = (data.tags ?? []) as { name: string }[]
        setAllLocationTags(tags.map((t) => t.name))
      })
      .catch(() => {})
  }, [locationId, demoContact])

  useEffect(() => {
    if (!contactId) return

    if (demoContact) {
      const parts = demoContact.contactName.split(' ')
      const c: ContactDetail = {
        id: demoContact.id,
        firstName: parts[0],
        lastName: parts.slice(1).join(' '),
        email: demoContact.email ?? undefined,
        phone: demoContact.phone ?? undefined,
        city: demoContact.city ?? undefined,
        tags: demoContact.tags,
      }
      setContact(c)
      setEditData({
        firstName: c.firstName ?? '',
        lastName: c.lastName ?? '',
        email: c.email ?? '',
        phone: c.phone ?? '',
        companyName: '',
        address1: '',
        city: c.city ?? '',
      })
      setEditTags([...demoContact.tags])
      setTab('info')
      return
    }

    setLoading(true)
    setContact(null)
    setTab('info')
    getContactDetail(locationId, contactId).then((c) => {
      setContact(c)
      if (c) {
        setEditData({
          firstName: c.firstName ?? '',
          lastName: c.lastName ?? '',
          email: c.email ?? '',
          phone: c.phone ?? '',
          companyName: c.companyName ?? '',
          address1: c.address1 ?? '',
          city: c.city ?? '',
        })
        setEditTags([...(c.tags ?? [])])
      }
      setLoading(false)
    })
  }, [contactId, locationId, demoContact])

  // Filter tag suggestions
  useEffect(() => {
    if (!tagInput.trim()) {
      setTagSuggestions([])
      return
    }
    const q = tagInput.toLowerCase()
    setTagSuggestions(
      allLocationTags.filter((t) => t.toLowerCase().includes(q) && !editTags.includes(t)).slice(0, 8)
    )
  }, [tagInput, allLocationTags, editTags])

  function addTag(tag: string) {
    const trimmed = tag.trim()
    if (!trimmed || editTags.includes(trimmed)) return
    setEditTags([...editTags, trimmed])
    setTagInput('')
    setShowTagDropdown(false)
  }

  function removeTag(tag: string) {
    setEditTags(editTags.filter((t) => t !== tag))
  }

  function handleSave() {
    if (!contactId || !contact) return
    setSaveError(null)
    startSave(async () => {
      const res = await updateContact(locationId, contactId, { ...editData, tags: editTags })
      if (res?.error) {
        setSaveError(res.error)
      } else {
        setTab('info')
        const updated = await getContactDetail(locationId, contactId)
        setContact(updated)
        if (updated) setEditTags([...(updated.tags ?? [])])
        onContactUpdated?.()
      }
    })
  }

  function handleSendMessage() {
    if (!contactId || !message.trim()) return
    setSendResult(null)
    startSend(async () => {
      const res = await sendMessageToContact(locationId, contactId, message.trim(), 'SMS')
      if (res?.error) {
        setSendResult(res.error)
      } else {
        setSendResult('Inviato!')
        setMessage('')
        setTimeout(() => setSendResult(null), 2000)
      }
    })
  }

  if (!contactId) return null

  const initials = contact
    ? `${(contact.firstName ?? '')[0] ?? ''}${(contact.lastName ?? '')[0] ?? ''}`.toUpperCase() || '?'
    : ''

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l shadow-2xl" style={{ backgroundColor: 'var(--shell-surface)', borderColor: 'var(--shell-line)' }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--shell-line)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: 'var(--brand)' }}>
              {loading ? '…' : initials}
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                {loading ? 'Caricamento…' : contact ? `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim() || 'Senza nome' : 'Non trovato'}
              </h3>
              {contact?.companyName && <p className="text-xs" style={{ color: 'var(--shell-muted)' }}>{contact.companyName}</p>}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 transition hover:bg-black/5">
            <svg className="h-5 w-5" style={{ color: 'var(--shell-muted)' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Tabs */}
        {contact && (
          <div className="flex border-b px-5" style={{ borderColor: 'var(--shell-line)' }}>
            {(['info', 'edit', 'messages'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2.5 text-xs font-semibold capitalize transition ${tab === t ? 'border-b-2 text-brand' : ''}`}
                style={tab === t ? { borderColor: 'var(--brand)', color: 'var(--brand)' } : { color: 'var(--shell-muted)' }}
              >
                {t === 'info' ? 'Info' : t === 'edit' ? 'Modifica' : 'SMS'}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-brand" />
            </div>
          )}

          {!loading && !contact && (
            <p className="text-sm" style={{ color: 'var(--shell-muted)' }}>Contatto non trovato.</p>
          )}

          {/* Info Tab */}
          {!loading && contact && tab === 'info' && (
            <div className="space-y-4">
              <InfoRow label="Email" value={contact.email} />
              <InfoRow label="Telefono" value={contact.phone} />
              <InfoRow label="Azienda" value={contact.companyName} />
              <InfoRow label="Indirizzo" value={contact.address1} />
              <InfoRow label="Città" value={contact.city} />

              {contact.tags && contact.tags.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--shell-muted)' }}>Tag</p>
                  <div className="flex flex-wrap gap-1.5">
                    {contact.tags.map((t) => (
                      <span key={t} className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: 'var(--shell-soft)', color: 'var(--brand)' }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {contact.customFields && contact.customFields.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--shell-muted)' }}>Campi Personalizzati</p>
                  <div className="space-y-2">
                    {contact.customFields.filter((f) => f.value || f.field_value || f.fieldValue).map((f) => (
                      <div key={f.id} className="flex justify-between text-xs">
                        <span style={{ color: 'var(--shell-muted)' }}>{f.name || f.key || f.id}</span>
                        <span className="font-medium" style={{ color: 'var(--foreground)' }}>{String(f.value ?? f.field_value ?? f.fieldValue ?? '')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {contact.opportunities && contact.opportunities.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--shell-muted)' }}>Opportunità</p>
                  <div className="space-y-2">
                    {contact.opportunities.map((o) => (
                      <div key={o.id} className="rounded-xl border p-3" style={{ borderColor: 'var(--shell-line)' }}>
                        <p className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{o.name}</p>
                        <div className="mt-1 flex items-center gap-2 text-[11px]" style={{ color: 'var(--shell-muted)' }}>
                          <span>{o.stageName}</span>
                          {o.monetaryValue ? <span className="font-semibold" style={{ color: 'var(--brand)' }}>€{o.monetaryValue.toLocaleString()}</span> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Edit Tab */}
          {!loading && contact && tab === 'edit' && (
            <div className="space-y-3">
              <EditField label="Nome" value={editData.firstName} onChange={(v) => setEditData({ ...editData, firstName: v })} />
              <EditField label="Cognome" value={editData.lastName} onChange={(v) => setEditData({ ...editData, lastName: v })} />
              <EditField label="Email" value={editData.email} onChange={(v) => setEditData({ ...editData, email: v })} />
              <EditField label="Telefono" value={editData.phone} onChange={(v) => setEditData({ ...editData, phone: v })} />
              <EditField label="Azienda" value={editData.companyName} onChange={(v) => setEditData({ ...editData, companyName: v })} />
              <EditField label="Indirizzo" value={editData.address1} onChange={(v) => setEditData({ ...editData, address1: v })} />
              <EditField label="Città" value={editData.city} onChange={(v) => setEditData({ ...editData, city: v })} />

              {/* Tags */}
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--shell-muted)' }}>Tag</label>

                {/* Current tags */}
                {editTags.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {editTags.map((t) => (
                      <span key={t} className="group flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: 'var(--shell-soft)', color: 'var(--brand)' }}>
                        {t}
                        <button onClick={() => removeTag(t)} className="ml-0.5 rounded-full opacity-60 transition hover:opacity-100">
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Add tag input */}
                <div className="relative">
                  <input
                    ref={tagInputRef}
                    type="text"
                    value={tagInput}
                    onChange={(e) => { setTagInput(e.target.value); setShowTagDropdown(true) }}
                    onFocus={() => setShowTagDropdown(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && tagInput.trim()) {
                        e.preventDefault()
                        addTag(tagInput)
                      }
                    }}
                    placeholder="Digita per aggiungere tag…"
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--shell-line)', backgroundColor: 'var(--shell-canvas)', color: 'var(--foreground)' }}
                  />

                  {/* Suggestions dropdown */}
                  {showTagDropdown && tagSuggestions.length > 0 && (
                    <div className="absolute left-0 top-full z-10 mt-1 w-full max-h-40 overflow-y-auto rounded-xl border bg-white shadow-lg" style={{ borderColor: 'var(--shell-line)' }}>
                      {tagSuggestions.map((t) => (
                        <button
                          key={t}
                          onClick={() => addTag(t)}
                          className="block w-full px-3 py-2 text-left text-xs transition hover:bg-gray-50"
                          style={{ color: 'var(--foreground)' }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Show available tags when input is empty and focused */}
                  {showTagDropdown && !tagInput && allLocationTags.filter((t) => !editTags.includes(t)).length > 0 && (
                    <div className="absolute left-0 top-full z-10 mt-1 w-full max-h-40 overflow-y-auto rounded-xl border bg-white shadow-lg" style={{ borderColor: 'var(--shell-line)' }}>
                      {allLocationTags.filter((t) => !editTags.includes(t)).slice(0, 12).map((t) => (
                        <button
                          key={t}
                          onClick={() => addTag(t)}
                          className="block w-full px-3 py-2 text-left text-xs transition hover:bg-gray-50"
                          style={{ color: 'var(--foreground)' }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {saveError && <p className="text-xs font-medium text-red-600">{saveError}</p>}

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--brand)' }}
              >
                {saving ? 'Salvataggio…' : 'Salva'}
              </button>
            </div>
          )}

          {/* Messages Tab */}
          {!loading && contact && tab === 'messages' && (
            <div className="space-y-3">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Scrivi messaggio SMS…"
                rows={3}
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none resize-none"
                style={{ borderColor: 'var(--shell-line)', backgroundColor: 'var(--shell-canvas)', color: 'var(--foreground)' }}
              />
              {sendResult && (
                <p className={`text-xs font-medium ${sendResult === 'Inviato!' ? 'text-emerald-600' : 'text-red-600'}`}>{sendResult}</p>
              )}
              <button
                onClick={handleSendMessage}
                disabled={sending || !message.trim()}
                className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--brand)' }}
              >
                {sending ? 'Invio…' : 'Invia SMS'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--shell-muted)' }}>{label}</p>
      <p className="mt-0.5 text-sm" style={{ color: 'var(--foreground)' }}>{value}</p>
    </div>
  )
}

function EditField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--shell-muted)' }}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
        style={{ borderColor: 'var(--shell-line)', backgroundColor: 'var(--shell-canvas)', color: 'var(--foreground)' }}
      />
    </div>
  )
}
