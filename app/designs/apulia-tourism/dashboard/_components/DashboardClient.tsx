'use client'

import useSWR from 'swr'
import Link from 'next/link'
import SimfoniaPageHeader from '../../_components/SimfoniaPageHeader'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface Campaign {
  id: string
  type: string
  message: string
  status: string
  total: number
  sent: number
  createdAt: string
}

interface UnrepliedConvo {
  id: string
  contactName: string
  lastMessage: string
  lastMessageDate: string
}

interface DashboardData {
  ghlConnected?: boolean
  totalContacts: number
  unrepliedCount: number
  unrepliedConversations: UnrepliedConvo[]
  campaigns: {
    total: number
    active: number
    completed: number
    totalSent: number
    totalPending: number
  }
  recentCampaigns: Campaign[]
  nextBatch: {
    jobId: string
    scheduledAt: string
    batchSize: number
    remaining: number
  } | null
}

const DEMO_DATA: DashboardData = {
  totalContacts: 84,
  unrepliedCount: 7,
  unrepliedConversations: [
    { id: 'uc-1', contactName: 'Maria Bianchi', lastMessage: 'Perfetto, ci vediamo domani', lastMessageDate: '2026-04-24T09:15:00Z' },
    { id: 'uc-2', contactName: 'Giuseppe Ferro', lastMessage: 'Ho ricevuto il listino', lastMessageDate: '2026-04-24T08:00:00Z' },
    { id: 'uc-3', contactName: 'Anna Russo', lastMessage: 'Quando possiamo fissare?', lastMessageDate: '2026-04-23T16:40:00Z' },
  ],
  campaigns: { total: 6, active: 2, completed: 4, totalSent: 312, totalPending: 48 },
  recentCampaigns: [
    { id: 'c-1', type: 'SMS', message: 'Offerta speciale estate 2026 — scopri i nostri pacchetti!', status: 'active', total: 40, sent: 22, createdAt: '2026-04-24T07:00:00Z' },
    { id: 'c-2', type: 'WhatsApp', message: 'Reminder: conferma il tuo appuntamento', status: 'active', total: 15, sent: 7, createdAt: '2026-04-23T14:00:00Z' },
    { id: 'c-3', type: 'SMS', message: 'Benvenuto nel circuito Apulian Tourism!', status: 'completed', total: 84, sent: 84, createdAt: '2026-04-20T09:00:00Z' },
    { id: 'c-4', type: 'WhatsApp', message: 'Nuova partnership attiva — rispondi per info', status: 'completed', total: 50, sent: 50, createdAt: '2026-04-18T10:00:00Z' },
    { id: 'c-5', type: 'SMS', message: 'Follow-up primo contatto', status: 'completed', total: 63, sent: 63, createdAt: '2026-04-15T08:30:00Z' },
  ],
  nextBatch: { jobId: 'c-1', scheduledAt: '2026-04-24T13:00:00Z', batchSize: 10, remaining: 18 },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'adesso'
  if (mins < 60) return `${mins}m fa`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h fa`
  const days = Math.floor(hrs / 24)
  return `${days}g fa`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function DashboardClient({
  locationId,
  demoData,
  demoMode = false,
}: {
  locationId: string
  demoData?: DashboardData
  demoMode?: boolean
}) {
  const { data: swrData, isLoading } = useSWR<DashboardData>(
    demoMode ? null : `/api/apulia-dashboard?locationId=${locationId}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 15000 }
  )
  const data = demoMode ? (demoData ?? DEMO_DATA) : swrData

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <SimfoniaPageHeader eyebrow="Panoramica" title="Dashboard" description="Caricamento…" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl" style={{ backgroundColor: 'var(--shell-soft)' }} />
          ))}
        </div>
      </div>
    )
  }

  const base = demoMode ? '/designs/apulia-tourism/demo' : '/designs/apulia-tourism'
  const qs = demoMode ? '' : `?locationId=${locationId}`

  return (
    <div className="space-y-6">
      <SimfoniaPageHeader eyebrow="Panoramica" title="Dashboard" description="Contatti e campagne di messaggistica a colpo d'occhio." />

      {/* GHL connection warning */}
      {data.ghlConnected === false && !demoMode && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3">
          <p className="text-sm font-semibold text-amber-800">Connessione GHL scaduta</p>
          <p className="mt-0.5 text-xs text-amber-600">I dati in tempo reale non sono disponibili. Vai su Admin → Locations e riconnetti GHL per aggiornare conversazioni, contatti e template.</p>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Contatti Totali"
          value={data.totalContacts}
          icon={<IconContacts />}
          href={`${base}/contacts${qs}`}
        />
        <KpiCard
          label="Senza Risposta"
          value={data.unrepliedCount}
          icon={<IconUnreplied />}
          accent={data.unrepliedCount > 0 ? 'warning' : undefined}
          href={`${base}/conversations${qs}`}
        />
        <KpiCard
          label="Messaggi Inviati"
          value={data.campaigns.totalSent}
          icon={<IconSent />}
        />
        <KpiCard
          label="In Attesa"
          value={data.campaigns.totalPending}
          icon={<IconPending />}
          accent={data.campaigns.totalPending > 0 ? 'info' : undefined}
        />
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Campaigns */}
        <div className="space-y-4">
          {/* Campaign Stats */}
          <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--shell-line)', backgroundColor: 'var(--shell-surface)' }}>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--shell-muted)' }}>Campagne</h3>
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="Totali" value={data.campaigns.total} />
              <MiniStat label="Attive" value={data.campaigns.active} color="var(--brand)" />
              <MiniStat label="Completate" value={data.campaigns.completed} color="#16a34a" />
            </div>
          </div>

          {/* Next Batch */}
          {data.nextBatch && (
            <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--shell-line)', backgroundColor: 'var(--shell-surface)' }}>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--shell-muted)' }}>Prossimo Invio Programmato</h3>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: 'var(--shell-soft)' }}>
                  <svg className="h-5 w-5" style={{ color: 'var(--brand)' }} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{formatDate(data.nextBatch.scheduledAt)}</p>
                  <p className="text-xs" style={{ color: 'var(--shell-muted)' }}>
                    {data.nextBatch.batchSize} messaggi · {data.nextBatch.remaining} rimanenti
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Recent Campaigns */}
          <div className="rounded-2xl border" style={{ borderColor: 'var(--shell-line)', backgroundColor: 'var(--shell-surface)' }}>
            <div className="border-b px-5 py-3" style={{ borderColor: 'var(--shell-line)' }}>
              <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--shell-muted)' }}>Campagne Recenti</h3>
            </div>
            {data.recentCampaigns.length === 0 ? (
              <p className="px-5 py-6 text-center text-xs" style={{ color: 'var(--shell-muted)' }}>Nessuna campagna. Seleziona i contatti e invia il tuo primo messaggio.</p>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--shell-line)' }}>
                {data.recentCampaigns.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${c.type === 'WhatsApp' ? 'bg-emerald-50 text-emerald-700' : ''}`} style={c.type !== 'WhatsApp' ? { backgroundColor: 'var(--shell-soft)', color: 'var(--brand)' } : {}}>
                      {c.type === 'WhatsApp' ? 'WA' : 'SMS'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium" style={{ color: 'var(--foreground)' }}>{c.message}</p>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px]" style={{ color: 'var(--shell-muted)' }}>
                        <span>{timeAgo(c.createdAt)}</span>
                        <span>·</span>
                        <span>{c.sent}/{c.total} inviati</span>
                      </div>
                    </div>
                    <StatusBadge status={c.status} />
                    {/* Progress bar */}
                    <div className="w-16">
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--shell-soft)' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${(c.sent / c.total) * 100}%`, backgroundColor: c.status === 'completed' ? '#16a34a' : 'var(--brand)' }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Unreplied + Quick Actions */}
        <div className="space-y-4">
          {/* Unreplied Conversations */}
          <div className="rounded-2xl border" style={{ borderColor: 'var(--shell-line)', backgroundColor: 'var(--shell-surface)' }}>
            <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--shell-line)' }}>
              <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--shell-muted)' }}>Conversazioni Senza Risposta</h3>
              {data.unrepliedCount > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">{data.unrepliedCount}</span>
              )}
            </div>
            {data.unrepliedConversations.length === 0 ? (
              <div className="px-5 py-6 text-center">
                <p className="text-xs font-medium" style={{ color: 'var(--brand)' }}>Tutto aggiornato!</p>
                <p className="mt-0.5 text-[10px]" style={{ color: 'var(--shell-muted)' }}>Nessuna risposta in sospeso</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--shell-line)' }}>
                {data.unrepliedConversations.map((c) => (
                  <div key={c.id} className="px-5 py-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{c.contactName}</p>
                      <span className="text-[10px]" style={{ color: 'var(--shell-muted)' }}>{timeAgo(c.lastMessageDate)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--shell-muted)' }}>{c.lastMessage}</p>
                  </div>
                ))}
              </div>
            )}
            {data.unrepliedCount > 3 && (
              <div className="border-t px-5 py-2.5" style={{ borderColor: 'var(--shell-line)' }}>
                <Link href={`${base}/conversations${qs}`} className="text-xs font-semibold" style={{ color: 'var(--brand)' }}>
                  Vedi tutte →
                </Link>
              </div>
            )}
          </div>

          {/* Recent campaigns link */}
          {data.recentCampaigns.length > 0 && (
            <div className="rounded-2xl border p-4 text-center" style={{ borderColor: 'var(--shell-line)', backgroundColor: 'var(--shell-surface)' }}>
              <Link href={`${base}/campaigns${qs}`} className="text-xs font-semibold" style={{ color: 'var(--brand)' }}>
                Vedi tutte le campagne →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Sub-components ── */

function KpiCard({ label, value, icon, accent, href }: { label: string; value: number; icon: React.ReactNode; accent?: 'warning' | 'info'; href?: string }) {
  const content = (
    <div
      className="rounded-2xl border p-4 transition hover:shadow-sm"
      style={{ borderColor: 'var(--shell-line)', backgroundColor: 'var(--shell-surface)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: accent === 'warning' ? '#fef3c7' : accent === 'info' ? '#dbeafe' : 'var(--shell-soft)' }}>
          {icon}
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold tabular-nums" style={{ color: 'var(--foreground)' }}>{value.toLocaleString()}</p>
      <p className="mt-0.5 text-[11px] font-medium" style={{ color: 'var(--shell-muted)' }}>{label}</p>
    </div>
  )
  return href ? <Link href={href}>{content}</Link> : content
}

function MiniStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="text-center">
      <p className="text-xl font-bold tabular-nums" style={{ color: color ?? 'var(--foreground)' }}>{value}</p>
      <p className="text-[10px] font-medium" style={{ color: 'var(--shell-muted)' }}>{label}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles = status === 'active'
    ? 'bg-amber-50 text-amber-700'
    : status === 'completed'
      ? 'bg-emerald-50 text-emerald-700'
      : 'bg-gray-100 text-gray-500'
  const label = status === 'active' ? 'attiva' : status === 'completed' ? 'completata' : status
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${styles}`}>{label}</span>
}

function IconContacts() {
  return <svg className="h-4.5 w-4.5" style={{ color: 'var(--brand)' }} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>
}

function IconUnreplied() {
  return <svg className="h-4.5 w-4.5 text-amber-600" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
}

function IconSent() {
  return <svg className="h-4.5 w-4.5" style={{ color: 'var(--brand)' }} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg>
}

function IconPending() {
  return <svg className="h-4.5 w-4.5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
}
