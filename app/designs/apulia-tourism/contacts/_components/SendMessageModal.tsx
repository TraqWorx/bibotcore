'use client'

import { useState, useRef, useEffect } from 'react'

interface Contact {
  id: string
  contactName: string
  phone: string | null
}

interface Template {
  id: string
  name: string
  body: string
  status: string
}

interface Props {
  locationId: string
  contacts: Contact[]
  onClose: () => void
}

export default function SendMessageModal({ locationId, contacts, onClose }: Props) {
  const [message, setMessage] = useState('')
  const [templates, setTemplates] = useState<Template[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [sendMode, setSendMode] = useState<'now' | 'schedule' | 'drip'>('now')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [dripBatchSize, setDripBatchSize] = useState('10')
  const [dripInterval, setDripInterval] = useState('1')
  const [dripUnit, setDripUnit] = useState<'minutes' | 'hours' | 'days'>('hours')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch WhatsApp templates (Meta-approved)
  useEffect(() => {
    fetch(`/api/ghl/templates?locationId=${locationId}`)
      .then((r) => r.json())
      .then((data) => {
        const all = (data.templates ?? []) as { id: string; name: string; body?: string; templateBody?: string; status?: string }[]
        setTemplates(
          all
            .filter((t) => t.status === 'APPROVED' || t.status === 'approved')
            .map((t) => ({ id: t.id, name: t.name, body: t.body ?? t.templateBody ?? '', status: t.status ?? '' }))
        )
      })
      .catch(() => {})
      .finally(() => setTemplatesLoading(false))
  }, [locationId])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    if (f.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => setFilePreview(reader.result as string)
      reader.readAsDataURL(f)
    } else {
      setFilePreview(null)
    }
  }

  function removeFile() {
    setFile(null)
    setFilePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function getDripIntervalMinutes(): number {
    const val = parseInt(dripInterval) || 1
    if (dripUnit === 'days') return val * 1440
    if (dripUnit === 'hours') return val * 60
    return val
  }

  async function handleSend() {
    if (!message.trim()) { setError('Write a message'); return }
    setSending(true)
    setError(null)
    setProgress(0)

    // Upload file if present
    let attachmentUrl: string | null = null
    if (file) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('locationId', locationId)
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
        if (uploadRes.ok) {
          const data = await uploadRes.json()
          attachmentUrl = data.url ?? null
        }
      } catch { /* proceed without attachment */ }
    }

    try {
      if (sendMode === 'now') {
        for (let i = 0; i < contacts.length; i++) {
          await sendOne(contacts[i], undefined, attachmentUrl)
          setProgress(i + 1)
        }
      } else if (sendMode === 'schedule') {
        if (!scheduleDate || !scheduleTime) { setError('Select date and time'); setSending(false); return }
        const scheduledTs = new Date(`${scheduleDate}T${scheduleTime}`).toISOString()
        for (let i = 0; i < contacts.length; i++) {
          await sendOne(contacts[i], scheduledTs, attachmentUrl)
          setProgress(i + 1)
        }
      } else if (sendMode === 'drip') {
        const batch = parseInt(dripBatchSize) || 10
        const intervalMinutes = getDripIntervalMinutes()
        const res = await fetch('/api/messages/drip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locationId,
            contactIds: contacts.map((c) => c.id),
            type: 'SMS',
            message: message.trim(),
            imageUrl: attachmentUrl,
            batchSize: batch,
            intervalMinutes,
          }),
        })
        if (res.ok) {
          setProgress(contacts.length)
        } else {
          const data = await res.json().catch(() => ({}))
          setError(data.error ?? 'Failed to create drip')
          setSending(false)
          return
        }
      }
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed')
    }
    setSending(false)
  }

  async function sendOne(contact: Contact, scheduledTimestamp?: string, attachmentUrl?: string | null) {
    await fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locationId,
        contactId: contact.id,
        type: 'SMS',
        message: message.trim(),
        ...(attachmentUrl ? { attachments: [attachmentUrl] } : {}),
        ...(scheduledTimestamp ? { scheduledTimestamp } : {}),
      }),
    })
  }

  if (sent) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
            <svg className="h-6 w-6 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="font-bold text-gray-900">
            {sendMode === 'drip' ? 'Drip feed created!' : sendMode === 'schedule' ? 'Messages scheduled!' : 'Messages sent!'}
          </p>
          <p className="mt-1 text-sm text-gray-500">{contacts.length} contacts</p>
          <button onClick={onClose} className="mt-4 rounded-xl bg-gray-900 px-6 py-2 text-sm font-semibold text-white">Done</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Send SMS</h2>
            <p className="text-xs text-gray-500">{contacts.length} recipients selected</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Template picker */}
          <div className="relative">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              disabled={templatesLoading || templates.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
              {templatesLoading ? 'Loading templates…' : templates.length === 0 ? 'No approved templates' : `Use Template (${templates.length})`}
            </button>
            {showTemplates && templates.length > 0 && (
              <div className="absolute left-0 top-full z-10 mt-1 max-h-60 w-80 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setMessage(t.body); setShowTemplates(false) }}
                    className="block w-full px-4 py-2.5 text-left text-xs transition hover:bg-gray-50 border-b border-gray-100 last:border-0"
                  >
                    <span className="font-semibold text-gray-900">{t.name}</span>
                    <p className="mt-0.5 text-gray-500 line-clamp-2">{t.body}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Message */}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            rows={4}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 resize-none"
          />

          {/* File upload */}
          <div>
            {file ? (
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-2.5">
                {filePreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={filePreview} alt="Preview" className="h-10 w-10 rounded-lg object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-medium text-gray-900">{file.name}</p>
                  <p className="text-[10px] text-gray-400">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
                <button onClick={removeFile} className="text-gray-400 hover:text-red-500">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-3 text-xs text-gray-400 transition hover:border-gray-400 hover:text-gray-600"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" /></svg>
                Attach file (image, PDF...)
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx" onChange={handleFileChange} className="hidden" />
          </div>

          {/* Send mode */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Delivery</p>
            <div className="flex gap-2">
              <button onClick={() => setSendMode('now')} className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition ${sendMode === 'now' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>Send Now</button>
              <button onClick={() => setSendMode('schedule')} className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition ${sendMode === 'schedule' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>Schedule</button>
              <button onClick={() => setSendMode('drip')} className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition ${sendMode === 'drip' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>Drip Feed</button>
            </div>
          </div>

          {/* Schedule options */}
          {sendMode === 'schedule' && (
            <div className="flex gap-2">
              <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none" />
              <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none" />
            </div>
          )}

          {/* Drip feed options */}
          {sendMode === 'drip' && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Send</span>
              <input type="number" value={dripBatchSize} onChange={(e) => setDripBatchSize(e.target.value)} className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-center text-sm outline-none" min="1" />
              <span>every</span>
              <input type="number" value={dripInterval} onChange={(e) => setDripInterval(e.target.value)} className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-center text-sm outline-none" min="1" />
              <select value={dripUnit} onChange={(e) => setDripUnit(e.target.value as 'minutes' | 'hours' | 'days')} className="rounded-lg border border-gray-200 px-2 py-1 text-sm outline-none">
                <option value="minutes">minutes</option>
                <option value="hours">hours</option>
                <option value="days">days</option>
              </select>
            </div>
          )}

          {error && <p className="text-xs font-medium text-red-600">{error}</p>}

          {sending && (
            <div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(progress / contacts.length) * 100}%` }} />
              </div>
              <p className="mt-1 text-xs text-gray-400 text-center">{progress} / {contacts.length}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            onClick={handleSend}
            disabled={sending || !message.trim()}
            className="rounded-xl bg-gray-900 px-6 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {sending ? 'Sending...' : sendMode === 'drip' ? 'Start Drip' : sendMode === 'schedule' ? 'Schedule' : 'Send Now'}
          </button>
        </div>
      </div>
    </div>
  )
}
