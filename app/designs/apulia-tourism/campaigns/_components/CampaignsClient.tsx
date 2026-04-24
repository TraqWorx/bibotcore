'use client'

import { useState } from 'react'
import useSWR from 'swr'
import SimfoniaPageHeader from '../../_components/SimfoniaPageHeader'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface Campaign {
  id: string
  type: string
  message: string
  contact_ids: string[]
  batch_size: number
  interval_minutes: number
  sent_count: number
  status: string
  last_batch_at: string | null
  created_at: string
  image_url: string | null
}

const DEMO_CAMPAIGNS: Campaign[] = [
  { id: 'dc-1', type: 'SMS', message: 'Offerta speciale estate 2026 — scopri i pacchetti turistici dedicati ai nostri partner!', contact_ids: Array(40).fill(''), batch_size: 10, interval_minutes: 60, sent_count: 22, status: 'active', last_batch_at: '2026-04-24T11:00:00Z', created_at: '2026-04-24T07:00:00Z', image_url: null },
  { id: 'dc-2', type: 'WhatsApp', message: 'Reminder: conferma il tuo appuntamento per la revisione del pacchetto', contact_ids: Array(15).fill(''), batch_size: 5, interval_minutes: 120, sent_count: 7, status: 'active', last_batch_at: '2026-04-24T08:00:00Z', created_at: '2026-04-23T14:00:00Z', image_url: null },
  { id: 'dc-3', type: 'SMS', message: 'Benvenuto nel circuito Apulian Tourism! Siamo felici di averti con noi.', contact_ids: Array(84).fill(''), batch_size: 20, interval_minutes: 30, sent_count: 84, status: 'completed', last_batch_at: '2026-04-20T11:30:00Z', created_at: '2026-04-20T09:00:00Z', image_url: null },
  { id: 'dc-4', type: 'WhatsApp', message: 'Nuova partnership attiva — rispondi per ricevere informazioni e materiale promozionale', contact_ids: Array(50).fill(''), batch_size: 10, interval_minutes: 1440, sent_count: 50, status: 'completed', last_batch_at: '2026-04-22T10:00:00Z', created_at: '2026-04-18T10:00:00Z', image_url: null },
  { id: 'dc-5', type: 'SMS', message: 'Follow-up primo contatto — come possiamo aiutarti?', contact_ids: Array(63).fill(''), batch_size: 15, interval_minutes: 60, sent_count: 63, status: 'completed', last_batch_at: '2026-04-16T12:00:00Z', created_at: '2026-04-15T08:30:00Z', image_url: null },
  { id: 'dc-6', type: 'SMS', message: 'Aggiornamento listino prezzi stagione 2026', contact_ids: Array(30).fill(''), batch_size: 30, interval_minutes: 0, sent_count: 30, status: 'completed', last_batch_at: null, created_at: '2026-04-12T09:00:00Z', image_url: null },
]

function formatInterval(minutes: number): string {
  if (minutes === 0) return 'Sent all at once'
  if (minutes < 60) return `Every ${minutes} min`
  if (minutes < 1440) return `Every ${Math.round(minutes / 60)} hr${minutes >= 120 ? 's' : ''}`
  const days = Math.round(minutes / 1440)
  return `Every ${days} day${days > 1 ? 's' : ''}`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function timeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now()
  if (diff <= 0) return 'Due now'
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `in ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `in ${hrs}h ${mins % 60}m`
  return `in ${Math.floor(hrs / 24)}d`
}

export default function CampaignsClient({ locationId, demoMode = false }: { locationId: string; demoMode?: boolean }) {
  const { data, isLoading } = useSWR(
    demoMode ? null : `/api/campaigns?locationId=${locationId}`,
    fetcher,
    { revalidateOnFocus: false }
  )

  const campaigns: Campaign[] = demoMode ? DEMO_CAMPAIGNS : (data?.campaigns ?? [])
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'failed'>('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  const filtered = filter === 'all' ? campaigns : campaigns.filter((c) => c.status === filter)

  const stats = {
    total: campaigns.length,
    active: campaigns.filter((c) => c.status === 'active').length,
    completed: campaigns.filter((c) => c.status === 'completed').length,
    failed: campaigns.filter((c) => c.status === 'failed').length,
    totalSent: campaigns.reduce((s, c) => s + c.sent_count, 0),
    totalRecipients: campaigns.reduce((s, c) => s + c.contact_ids.length, 0),
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SimfoniaPageHeader eyebrow="Messaging" title="Campaigns" description="Loading…" />
        <div className="h-64 animate-pulse rounded-2xl" style={{ backgroundColor: 'var(--shell-soft)' }} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SimfoniaPageHeader eyebrow="Messaging" title="Campaigns" description="Track all your bulk messaging campaigns." />

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Total Campaigns" value={stats.total} />
        <StatCard label="Active" value={stats.active} color="var(--brand)" />
        <StatCard label="Completed" value={stats.completed} color="#16a34a" />
        <StatCard label="Messages Sent" value={stats.totalSent} />
        <StatCard label="Total Recipients" value={stats.totalRecipients} />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5">
        {(['all', 'active', 'completed', 'failed'] as const).map((f) => {
          const count = f === 'all' ? campaigns.length : campaigns.filter((c) => c.status === f).length
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="rounded-full border px-3 py-1 text-[11px] font-semibold capitalize transition"
              style={filter === f
                ? { borderColor: 'var(--brand)', backgroundColor: 'color-mix(in srgb, var(--brand) 10%, transparent)', color: 'var(--brand)' }
                : { borderColor: 'var(--shell-line)', color: 'var(--shell-muted)' }
              }
            >
              {f} ({count})
            </button>
          )
        })}
      </div>

      {/* Campaign list */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border p-10 text-center" style={{ borderColor: 'var(--shell-line)', backgroundColor: 'var(--shell-surface)' }}>
          <p className="text-sm" style={{ color: 'var(--shell-muted)' }}>No campaigns found.</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--shell-muted)' }}>Go to Contacts, select recipients, and click Send Message to create a campaign.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => {
            const total = c.contact_ids.length
            const sent = c.sent_count
            const remaining = total - sent
            const progress = total > 0 ? (sent / total) * 100 : 0
            const isExpanded = expanded === c.id
            const isDrip = c.interval_minutes > 0
            const nextBatchAt = c.status === 'active' && isDrip && c.last_batch_at
              ? new Date(new Date(c.last_batch_at).getTime() + c.interval_minutes * 60000).toISOString()
              : null

            return (
              <div
                key={c.id}
                className="rounded-2xl border overflow-hidden transition"
                style={{ borderColor: 'var(--shell-line)', backgroundColor: 'var(--shell-surface)' }}
              >
                {/* Main row */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : c.id)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left"
                >
                  {/* Type badge */}
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${c.type === 'WhatsApp' ? 'bg-emerald-50 text-emerald-700' : ''}`} style={c.type !== 'WhatsApp' ? { backgroundColor: 'var(--shell-soft)', color: 'var(--brand)' } : {}}>
                    {c.type === 'WhatsApp' ? 'WA' : 'SMS'}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" style={{ color: 'var(--foreground)' }}>{c.message}</p>
                    <div className="mt-1 flex items-center gap-3 text-[11px]" style={{ color: 'var(--shell-muted)' }}>
                      <span>{formatDate(c.created_at)}</span>
                      {isDrip && <span>· {formatInterval(c.interval_minutes)}</span>}
                      <span>· Batch: {c.batch_size}</span>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="hidden w-32 shrink-0 sm:block">
                    <div className="flex items-center justify-between text-[10px] font-semibold" style={{ color: 'var(--shell-muted)' }}>
                      <span>{sent}/{total}</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--shell-soft)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: c.status === 'completed' ? '#16a34a' : c.status === 'failed' ? '#dc2626' : 'var(--brand)' }} />
                    </div>
                  </div>

                  {/* Status */}
                  <StatusBadge status={c.status} />

                  {/* Chevron */}
                  <svg className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} style={{ color: 'var(--shell-muted)' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t px-5 py-4 space-y-3" style={{ borderColor: 'var(--shell-line)', backgroundColor: 'color-mix(in srgb, var(--shell-canvas) 50%, var(--shell-surface))' }}>
                    {/* Full message */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--shell-muted)' }}>Message</p>
                      <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--foreground)' }}>{c.message}</p>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <DetailStat label="Total Recipients" value={total} />
                      <DetailStat label="Sent" value={sent} color="#16a34a" />
                      <DetailStat label="Remaining" value={remaining} color={remaining > 0 ? 'var(--brand)' : undefined} />
                      <DetailStat label="Batch Size" value={c.batch_size} />
                    </div>

                    {/* Delivery info */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--shell-muted)' }}>Delivery</p>
                        <p className="mt-0.5 text-xs font-medium" style={{ color: 'var(--foreground)' }}>
                          {isDrip ? `Drip — ${formatInterval(c.interval_minutes)}` : 'Sent all at once'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--shell-muted)' }}>Created</p>
                        <p className="mt-0.5 text-xs font-medium" style={{ color: 'var(--foreground)' }}>{formatDate(c.created_at)}</p>
                      </div>
                      {c.last_batch_at && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--shell-muted)' }}>Last Batch</p>
                          <p className="mt-0.5 text-xs font-medium" style={{ color: 'var(--foreground)' }}>{formatDate(c.last_batch_at)}</p>
                        </div>
                      )}
                    </div>

                    {/* Next batch */}
                    {nextBatchAt && remaining > 0 && (
                      <div className="flex items-center gap-2 rounded-xl border px-3 py-2.5" style={{ borderColor: 'var(--brand)', backgroundColor: 'color-mix(in srgb, var(--brand) 5%, transparent)' }}>
                        <svg className="h-4 w-4 shrink-0" style={{ color: 'var(--brand)' }} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                        <p className="text-xs font-medium" style={{ color: 'var(--brand)' }}>
                          Next batch: {Math.min(c.batch_size, remaining)} messages {timeUntil(nextBatchAt)} — {formatDate(nextBatchAt)}
                        </p>
                      </div>
                    )}

                    {/* Progress bar (mobile) */}
                    <div className="sm:hidden">
                      <div className="flex items-center justify-between text-[10px] font-semibold" style={{ color: 'var(--shell-muted)' }}>
                        <span>{sent}/{total} sent</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div className="mt-1 h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--shell-soft)' }}>
                        <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: c.status === 'completed' ? '#16a34a' : 'var(--brand)' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--shell-line)', backgroundColor: 'var(--shell-surface)' }}>
      <p className="text-xl font-bold tabular-nums" style={{ color: color ?? 'var(--foreground)' }}>{value.toLocaleString()}</p>
      <p className="text-[10px] font-medium" style={{ color: 'var(--shell-muted)' }}>{label}</p>
    </div>
  )
}

function DetailStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl border px-3 py-2" style={{ borderColor: 'var(--shell-line)' }}>
      <p className="text-lg font-bold tabular-nums" style={{ color: color ?? 'var(--foreground)' }}>{value}</p>
      <p className="text-[9px] font-medium uppercase tracking-widest" style={{ color: 'var(--shell-muted)' }}>{label}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles = status === 'active'
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : status === 'completed'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : status === 'failed'
        ? 'bg-red-50 text-red-700 border-red-200'
        : 'bg-gray-50 text-gray-500 border-gray-200'
  return <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold capitalize ${styles}`}>{status}</span>
}
