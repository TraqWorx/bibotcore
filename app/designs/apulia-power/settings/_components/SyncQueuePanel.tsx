'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { retryFailedOps, triggerDrainNow, type SyncQueueStats } from '../_actions'

interface Props {
  initial: SyncQueueStats
}

export default function SyncQueuePanel({ initial }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  function refresh() {
    setMessage(null)
    startTransition(() => router.refresh())
  }

  function retry() {
    setMessage(null)
    startTransition(async () => {
      const r = await retryFailedOps()
      if (r.error) setMessage(`Errore: ${r.error}`)
      else setMessage(`${r.retried} operazioni rimesse in coda.`)
      router.refresh()
    })
  }

  function drainNow() {
    setMessage(null)
    startTransition(async () => {
      const r = await triggerDrainNow()
      if (!r.ok) setMessage(`Errore: ${r.error}`)
      else setMessage('Drain avviato.')
      router.refresh()
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        <Stat label="In coda" value={initial.pending} />
        <Stat label="In esecuzione" value={initial.inProgress} />
        <Stat label="Falliti" value={initial.failed} accent={initial.failed > 0 ? 'danger' : undefined} />
        <Stat label="Completati (24h)" value={initial.completedLast24h} />
        <Stat
          label="Più vecchio in coda"
          value={initial.oldestPendingMinutes != null ? `${initial.oldestPendingMinutes} min` : '—'}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="ap-btn" onClick={refresh} disabled={pending}>Aggiorna</button>
        <button className="ap-btn" onClick={drainNow} disabled={pending}>Drain ora</button>
        <button className="ap-btn ap-btn-danger" onClick={retry} disabled={pending || initial.failed === 0}>
          Riprova falliti ({initial.failed})
        </button>
      </div>

      {message && (
        <p style={{ fontSize: 12, color: 'var(--ap-text-muted)', margin: 0 }}>{message}</p>
      )}

      <p style={{ fontSize: 11, color: 'var(--ap-text-faint)', margin: 0, lineHeight: 1.5 }}>
        Le modifiche in Bibot vengono applicate immediatamente al database e poi inviate
        a GHL in background dal worker. La coda viene drenata ogni minuto da pg_cron.
        Se vedi numeri che non scendono, prova un drain manuale o riavvia i falliti.
      </p>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: 'danger' }) {
  return (
    <div className="ap-card ap-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ap-text-muted)' }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 800, color: accent === 'danger' ? 'var(--ap-danger)' : 'var(--ap-text)' }}>{value}</span>
    </div>
  )
}
