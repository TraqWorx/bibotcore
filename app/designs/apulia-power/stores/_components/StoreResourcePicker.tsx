'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { assignFormToStore, assignCalendarToStore } from '../_actions'

interface FormOption { id: string; name: string }
interface CalendarOption { id: string; name: string; slug?: string | null; widgetSlug?: string | null }

interface Props {
  storeId: string
  forms: FormOption[]
  calendars: CalendarOption[]
  currentFormId: string | null
  currentCalendarId: string | null
  currentCalendarWidgetSlug: string | null
}

export default function StoreResourcePicker({
  storeId, forms, calendars, currentFormId, currentCalendarId, currentCalendarWidgetSlug,
}: Props) {
  const [pending, startTransition] = useTransition()
  const [flash, setFlash] = useState<string | null>(null)
  const router = useRouter()

  function changeForm(formId: string) {
    setFlash(null)
    startTransition(async () => {
      const r = await assignFormToStore(storeId, formId || null)
      setFlash(r?.error ? `Errore: ${r.error}` : '✓ Form salvato')
      router.refresh()
      setTimeout(() => setFlash(null), 2000)
    })
  }

  function changeCalendar(value: string) {
    setFlash(null)
    if (!value) {
      startTransition(async () => {
        const r = await assignCalendarToStore(storeId, null, null)
        setFlash(r?.error ? `Errore: ${r.error}` : '✓ Calendario salvato')
        router.refresh()
        setTimeout(() => setFlash(null), 2000)
      })
      return
    }
    const cal = calendars.find((c) => c.id === value)
    if (!cal) return
    startTransition(async () => {
      const r = await assignCalendarToStore(storeId, cal.id, cal.widgetSlug ?? cal.slug ?? null)
      setFlash(r?.error ? `Errore: ${r.error}` : '✓ Calendario salvato')
      router.refresh()
      setTimeout(() => setFlash(null), 2000)
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ap-text-muted)' }}>Form</span>
          <select
            value={currentFormId ?? ''}
            onChange={(e) => changeForm(e.target.value)}
            disabled={pending}
            className="ap-input"
            style={{ height: 32, fontSize: 12 }}
          >
            <option value="">— nessun form —</option>
            {forms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ap-text-muted)' }}>Calendario</span>
          <select
            value={currentCalendarId ?? ''}
            onChange={(e) => changeCalendar(e.target.value)}
            disabled={pending}
            className="ap-input"
            style={{ height: 32, fontSize: 12 }}
          >
            <option value="">— nessun calendario —</option>
            {calendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </div>
      {flash && <span style={{ fontSize: 11, color: flash.startsWith('Errore') ? 'var(--ap-danger)' : 'var(--ap-success)' }}>{flash}</span>}
    </div>
  )
}
