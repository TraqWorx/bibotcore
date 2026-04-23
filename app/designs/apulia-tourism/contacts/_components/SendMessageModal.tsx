'use client'

import { useState } from 'react'

interface Contact {
  id: string
  contactName: string
  phone: string | null
}

interface Props {
  locationId: string
  contacts: Contact[]
  onClose: () => void
}

export default function SendMessageModal({ locationId, contacts, onClose }: Props) {
  const [messageType, setMessageType] = useState<'SMS' | 'WhatsApp'>('SMS')
  const [message, setMessage] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [sendMode, setSendMode] = useState<'now' | 'schedule' | 'drip'>('now')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [dripBatchSize, setDripBatchSize] = useState('10')
  const [dripInterval, setDripInterval] = useState('60') // minutes
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    if (!message.trim()) { setError('Write a message'); return }
    setSending(true)
    setError(null)
    setProgress(0)

    try {
      if (sendMode === 'now') {
        // Send all immediately
        for (let i = 0; i < contacts.length; i++) {
          await sendOne(contacts[i])
          setProgress(i + 1)
        }
      } else if (sendMode === 'schedule') {
        // Schedule all at the specified time
        if (!scheduleDate || !scheduleTime) { setError('Select date and time'); setSending(false); return }
        const scheduledTs = new Date(`${scheduleDate}T${scheduleTime}`).toISOString()
        for (let i = 0; i < contacts.length; i++) {
          await sendOne(contacts[i], scheduledTs)
          setProgress(i + 1)
        }
      } else if (sendMode === 'drip') {
        // Queue as drip feed
        const batch = parseInt(dripBatchSize) || 10
        const interval = parseInt(dripInterval) || 60
        const res = await fetch('/api/messages/drip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locationId,
            contactIds: contacts.map((c) => c.id),
            type: messageType,
            message: message.trim(),
            imageUrl: imageUrl.trim() || null,
            batchSize: batch,
            intervalMinutes: interval,
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

  async function sendOne(contact: Contact, scheduledTimestamp?: string) {
    await fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locationId,
        contactId: contact.id,
        type: messageType,
        message: message.trim(),
        ...(imageUrl.trim() ? { attachments: [imageUrl.trim()] } : {}),
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
            <h2 className="text-sm font-bold text-gray-900">Send Message</h2>
            <p className="text-xs text-gray-500">{contacts.length} recipients selected</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Message type */}
          <div className="flex gap-2">
            <button onClick={() => setMessageType('SMS')} className={`flex-1 rounded-xl border py-2 text-sm font-semibold transition ${messageType === 'SMS' ? 'border-brand bg-brand/10 text-brand' : 'border-gray-200 text-gray-500'}`}>SMS</button>
            <button onClick={() => setMessageType('WhatsApp')} className={`flex-1 rounded-xl border py-2 text-sm font-semibold transition ${messageType === 'WhatsApp' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500'}`}>WhatsApp</button>
          </div>

          {/* Message */}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            rows={4}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 resize-none"
          />

          {/* Image URL */}
          <input
            type="text"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="Image URL (optional)"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-brand/40"
          />

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
              <span>messages every</span>
              <input type="number" value={dripInterval} onChange={(e) => setDripInterval(e.target.value)} className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-center text-sm outline-none" min="1" />
              <span>minutes</span>
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
