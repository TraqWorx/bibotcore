'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Props {
  initialFrom: string
  initialTo: string
  /** Path to push the new query params to. Defaults to /designs/apulia-power/stores. */
  basePath?: string
}

export default function DateRangeForm({ initialFrom, initialTo, basePath = '/designs/apulia-power/stores' }: Props) {
  const router = useRouter()
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)

  function apply(e: React.FormEvent) {
    e.preventDefault()
    const u = new URLSearchParams()
    if (from) u.set('from', from)
    if (to) u.set('to', to)
    router.push(`${basePath}${u.toString() ? '?' + u.toString() : ''}`)
  }

  function preset(kind: 'month' | '90days' | 'year' | 'all') {
    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    if (kind === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      setFrom(start.toISOString().slice(0, 10)); setTo(today)
    } else if (kind === '90days') {
      const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      setFrom(start.toISOString().slice(0, 10)); setTo(today)
    } else if (kind === 'year') {
      const start = new Date(now.getFullYear(), 0, 1)
      setFrom(start.toISOString().slice(0, 10)); setTo(today)
    } else {
      setFrom(''); setTo('')
    }
  }

  return (
    <form onSubmit={apply} className="ap-card ap-card-pad" style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Da</span>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="ap-input" style={{ height: 32, fontSize: 13 }} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>A</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="ap-input" style={{ height: 32, fontSize: 13 }} />
      </label>
      <button type="submit" className="ap-btn ap-btn-primary" style={{ height: 32 }}>Applica</button>
      <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
        <button type="button" onClick={() => preset('month')} className="ap-btn ap-btn-ghost" style={{ height: 30, fontSize: 11 }}>Mese corrente</button>
        <button type="button" onClick={() => preset('90days')} className="ap-btn ap-btn-ghost" style={{ height: 30, fontSize: 11 }}>Ultimi 90gg</button>
        <button type="button" onClick={() => preset('year')} className="ap-btn ap-btn-ghost" style={{ height: 30, fontSize: 11 }}>Quest&apos;anno</button>
        <button type="button" onClick={() => preset('all')} className="ap-btn ap-btn-ghost" style={{ height: 30, fontSize: 11 }}>Sempre</button>
      </div>
    </form>
  )
}
