import { createAdminClient } from '@/lib/supabase-server'
import { BIBOT_AGENCY_ID } from '@/lib/isBibotAgency'

const GHL_BASE = 'https://services.leadconnectorhq.com'

interface GhlUser {
  email?: string
  roles?: { type?: string; role?: string }
}

export interface ReconcileReport {
  skipped?: string
  ghlUsers: number
  demoted: string[]        // admin profile → agency (GHL account-level) — auto-applied
  prunedAgency: string[]   // role 'agency' profile no longer in GHL → deleted — auto-applied
  orphanAdmins: string[]   // role 'admin' not in GHL → flagged only (never auto-deleted)
  flaggedPromote: string[] // GHL agency-level but stored as 'agency' → flagged only (never auto-granted admin)
}

/**
 * Reconcile the Bibot agency's platform profiles against the live Bibot GHL
 * company user list. Maps GHL role type → platform role, prunes phantom
 * 'agency' members that no longer exist in GHL, and flags (never deletes)
 * admins missing from GHL.
 *
 * SAFETY: if GHL returns an error or an empty list, we abort without mutating —
 * so a transient API hiccup can never mass-delete users.
 *
 * Scope: Bibot only. Other agencies use their own GHL (OAuth per location) and
 * are reconciled by the existing per-location sync, not this company-token job.
 */
export async function reconcileBibotUsers(opts: { dryRun?: boolean } = {}): Promise<ReconcileReport> {
  const report: ReconcileReport = { ghlUsers: 0, demoted: [], prunedAgency: [], orphanAdmins: [], flaggedPromote: [] }

  const token = process.env.GHL_AGENCY_TOKEN
  const companyId = process.env.GHL_COMPANY_ID
  if (!token || !companyId) return { ...report, skipped: 'missing GHL agency token / company id' }

  // Fetch the full GHL company user list.
  const ghlByEmail = new Map<string, GhlUser>()
  try {
    const res = await fetch(`${GHL_BASE}/users/search?companyId=${companyId}&limit=500`, {
      headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28', Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return { ...report, skipped: `GHL users search HTTP ${res.status}` }
    const data = await res.json()
    const users = (data?.users ?? []) as GhlUser[]
    for (const u of users) if (u.email) ghlByEmail.set(u.email.toLowerCase(), u)
  } catch (err) {
    return { ...report, skipped: `GHL fetch failed: ${err instanceof Error ? err.message : 'error'}` }
  }

  report.ghlUsers = ghlByEmail.size
  // Safety gate: never act on an empty list (would prune everyone).
  if (ghlByEmail.size === 0) return { ...report, skipped: 'GHL returned 0 users — aborting to avoid mass prune' }

  const sb = createAdminClient()
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, email, role')
    .eq('agency_id', BIBOT_AGENCY_ID)
    .in('role', ['admin', 'agency'])

  for (const p of profiles ?? []) {
    const email = (p.email ?? '').toLowerCase()
    const g = ghlByEmail.get(email)

    if (!g) {
      if (p.role === 'agency') {
        report.prunedAgency.push(p.email)
        if (!opts.dryRun) {
          await sb.from('profile_locations').delete().eq('user_id', p.id)
          await sb.from('profiles').delete().eq('id', p.id)
        }
      } else {
        // Admin no longer in GHL — flag for manual review, never auto-delete an owner.
        report.orphanAdmins.push(p.email)
      }
      continue
    }

    const ghlType = g.roles?.type
    if (ghlType === 'account' && p.role === 'admin') {
      // Over-permissioned: auto-demote (reducing privilege is always safe).
      report.demoted.push(p.email)
      if (!opts.dryRun) await sb.from('profiles').update({ role: 'agency' }).eq('id', p.id)
    } else if (ghlType === 'agency' && p.role !== 'admin') {
      // GHL agency-level but only an 'agency' member here — flag for manual
      // approval. We never auto-GRANT admin (that would over-permission).
      report.flaggedPromote.push(p.email)
    }
  }

  return report
}
