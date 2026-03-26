'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

interface ActivityItem {
  id: string
  type: string
  entity_type?: string
  entity_id?: string
  data: Record<string, unknown>
  created_at: string
}

const TYPE_CONFIG: Record<string, { icon: string; color: string; label: (data: Record<string, unknown>) => string }> = {
  'deal.created': {
    icon: '💼',
    color: 'bg-purple-50',
    label: (d) => `Deal created: ${d.name ?? 'New deal'}`,
  },
  'deal.stage_changed': {
    icon: '🔀',
    color: 'bg-blue-50',
    label: (d) => `Deal moved to ${d.stageName ?? d.stage ?? 'new stage'}`,
  },
  'contact.created': {
    icon: '👤',
    color: 'bg-green-50',
    label: (d) => `Contact created: ${d.name ?? d.email ?? 'New contact'}`,
  },
  'appointment.created': {
    icon: '📅',
    color: 'bg-orange-50',
    label: (d) => `Appointment booked: ${d.title ?? 'New appointment'}`,
  },
  'message.sent': {
    icon: '📤',
    color: 'bg-gray-50',
    label: (d) => `Message sent${d.to ? ` to ${d.to}` : ''}`,
  },
  'message.received': {
    icon: '💬',
    color: 'bg-gray-50',
    label: (d) => `Message received${d.from ? ` from ${d.from}` : ''}`,
  },
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(dateStr).toLocaleDateString()
}

export default function ActivityFeed({ locationId }: { locationId: string }) {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Initial fetch
  useEffect(() => {
    supabase
      .from('activity_feed')
      .select('id, type, entity_type, entity_id, data, created_at')
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .limit(25)
      .then(({ data }) => {
        setItems((data as ActivityItem[]) ?? [])
        setLoading(false)
      })
  }, [locationId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`activity:${locationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_feed',
          filter: `location_id=eq.${locationId}`,
        },
        (payload) => {
          setItems((prev) => [payload.new as ActivityItem, ...prev].slice(0, 25))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [locationId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <p className="text-sm text-gray-400">Loading activity…</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-gray-900">Activity Feed</h2>
      </div>
      {items.length === 0 ? (
        <p className="p-6 text-sm text-gray-400">No activity yet. Start adding contacts, deals, or appointments.</p>
      ) : (
        <ol className="divide-y divide-gray-100">
          {items.map((item) => {
            const config = TYPE_CONFIG[item.type]
            const label = config?.label(item.data) ?? item.type
            return (
              <li key={item.id} className="flex items-start gap-3 px-5 py-3">
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm ${config?.color ?? 'bg-gray-50'}`}>
                  {config?.icon ?? '🔔'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-900">{label}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{formatRelative(item.created_at)}</p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
