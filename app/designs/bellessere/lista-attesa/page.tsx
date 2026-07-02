import { createAdminClient } from '@/lib/supabase-server'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'
import WaitlistForm from './WaitlistForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: "Bellessere — Lista d'attesa" }

export interface WlService { id: string; name: string; groupName: string; teamMembers: string[]; duration: number | null; interval: number | null }
export interface WlOperator { id: string; name: string }
export type WlInterval = { from: string; to: string }
// userId → weekday ('monday'…) → working intervals
export type WlSchedules = Record<string, Record<string, WlInterval[]>>

interface SchedRule { type?: string; day?: string; intervals?: WlInterval[] }

export default async function WaitlistPublicPage() {
  const sb = createAdminClient()
  const [{ data: services }, { data: groups }, { data: users }, { data: schedules }] = await Promise.all([
    sb.from('bellessere_services').select('id, name, group_id, team_members, slot_duration, slot_interval, is_active').eq('location_id', BELLESSERE_LOCATION_ID),
    sb.from('bellessere_groups').select('id, name').eq('location_id', BELLESSERE_LOCATION_ID),
    sb.from('bellessere_users').select('id, name').eq('location_id', BELLESSERE_LOCATION_ID).order('name'),
    sb.from('bellessere_schedules').select('user_id, rules').eq('location_id', BELLESSERE_LOCATION_ID),
  ])

  const schedulesByUser: WlSchedules = {}
  for (const s of schedules ?? []) {
    const byDay: Record<string, WlInterval[]> = {}
    for (const rule of ((s.rules as SchedRule[]) ?? [])) {
      if (rule.type === 'wday' && rule.day && Array.isArray(rule.intervals)) {
        byDay[rule.day] = rule.intervals.map(iv => ({ from: iv.from, to: iv.to }))
      }
    }
    schedulesByUser[s.user_id] = byDay
  }

  const groupName = new Map((groups ?? []).map(g => [g.id, g.name as string]))
  const svc: WlService[] = (services ?? [])
    .filter(s => s.is_active !== false)
    .map(s => ({
      id: s.id, name: s.name ?? '',
      groupName: (s.group_id ? groupName.get(s.group_id) : '') ?? 'Servizi',
      teamMembers: ((s.team_members as { userId: string }[]) ?? []).map(m => m.userId),
      duration: s.slot_duration ?? null,
      interval: s.slot_interval ?? null,
    }))
    .sort((a, b) => a.groupName.localeCompare(b.groupName) || a.name.localeCompare(b.name))
  const ops: WlOperator[] = (users ?? []).map(u => ({ id: u.id, name: u.name ?? '' }))

  return (
    <div style={{
      minHeight: '100vh',
      background:
        'radial-gradient(circle at 18% 0%, rgba(210,171,75,0.12), transparent 32%),'
        + 'linear-gradient(135deg, #F9FAFC 0%, #F3F5F8 60%, #E9EDF3 100%)',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif",
      color: '#121417', padding: '40px 16px', display: 'flex', justifyContent: 'center',
    }}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://ghlcustomdash.com/bellessere-logo.png" alt="Bellessere" width={120} height={120} style={{ display: 'block', margin: '0 auto', objectFit: 'contain', borderRadius: 18 }} />
        </div>
        <WaitlistForm services={svc} operators={ops} schedules={schedulesByUser} />
      </div>
    </div>
  )
}
