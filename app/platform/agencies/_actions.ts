'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient, createAuthClient } from '@/lib/supabase-server'
import { BIBOT_AGENCY_ID } from '@/lib/isBibotAgency'

async function requireSuperAdmin() {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') throw new Error('Not authorized')
}

/**
 * Invite a new agency admin by email. They receive a Supabase invite link;
 * on first login `/redirect` provisions their agency + admin profile.
 */
export async function inviteAdmin(email: string): Promise<{ error?: string; ok?: boolean }> {
  try {
    await requireSuperAdmin()
    const e = (email || '').trim().toLowerCase()
    if (!e || !e.includes('@')) return { error: 'Valid email required' }
    const sb = createAdminClient()
    const { data, error } = await sb.auth.admin.inviteUserByEmail(e, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
    })
    if (error) return { error: error.message }
    // Server-set marker (app_metadata, not user-forgeable) so /redirect provisions
    // their agency + admin on first login. Without it, profile-less users are refused.
    if (data?.user) {
      await sb.auth.admin.updateUserById(data.user.id, { app_metadata: { invited_admin: true } })
    }
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to invite' }
  }
}

/**
 * Soft deactivate / reactivate an agency: bans (or unbans) every user account
 * under it so they cannot log in. Nothing is deleted — fully reversible.
 */
export async function setAgencyActive(agencyId: string, active: boolean): Promise<{ error?: string; ok?: boolean }> {
  try {
    await requireSuperAdmin()
    if (!agencyId) return { error: 'agencyId required' }
    if (agencyId === BIBOT_AGENCY_ID) return { error: 'The Bibot agency cannot be deactivated.' }

    const sb = createAdminClient()
    const { data: profs } = await sb.from('profiles').select('id').eq('agency_id', agencyId)
    const banDuration = active ? 'none' : '876000h' // ~100 years = until reactivated
    for (const p of profs ?? []) {
      await sb.auth.admin.updateUserById(p.id, { ban_duration: banDuration }).catch(() => {})
    }
    revalidatePath('/platform/agencies')
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update agency' }
  }
}

/**
 * Permanently delete an agency and everything under it: locations, subscriptions,
 * costs, dashboard configs, GHL connections, installs, and all its user accounts
 * (profiles + auth). Hard, irreversible. The Bibot agency cannot be deleted.
 */
export async function deleteAgency(agencyId: string): Promise<{ error?: string; ok?: boolean }> {
  try {
    await requireSuperAdmin()
    if (!agencyId) return { error: 'agencyId required' }
    if (agencyId === BIBOT_AGENCY_ID) return { error: 'The Bibot agency cannot be deleted.' }

    const sb = createAdminClient()
    const [{ data: locs }, { data: profs }] = await Promise.all([
      sb.from('locations').select('location_id').eq('agency_id', agencyId),
      sb.from('profiles').select('id').eq('agency_id', agencyId),
    ])
    const locIds = (locs ?? []).map((l) => l.location_id)
    const userIds = (profs ?? []).map((p) => p.id)

    // 1. Children keyed by location
    if (locIds.length) {
      await sb.from('profile_locations').delete().in('location_id', locIds)
      await sb.from('dashboard_configs').delete().in('location_id', locIds)
      await sb.from('ghl_connections').delete().in('location_id', locIds)
      await sb.from('installs').delete().in('location_id', locIds)
      await sb.from('sync_status').delete().in('location_id', locIds)
    }
    // 2. Membership rows keyed by user
    if (userIds.length) await sb.from('profile_locations').delete().in('user_id', userIds)
    // 3. Rows keyed by agency
    await sb.from('agency_subscriptions').delete().eq('agency_id', agencyId)
    await sb.from('agency_costs').delete().eq('agency_id', agencyId)
    await sb.from('vat_quarter_status').delete().eq('agency_id', agencyId)
    await sb.from('dashboard_configs').delete().eq('agency_id', agencyId)
    await sb.from('locations').delete().eq('agency_id', agencyId)
    // 4. User accounts (profile + auth)
    for (const id of userIds) {
      await sb.from('profiles').delete().eq('id', id)
      await sb.auth.admin.deleteUser(id).catch(() => {})
    }
    // 5. The agency itself
    const { error } = await sb.from('agencies').delete().eq('id', agencyId)
    if (error) return { error: error.message }

    revalidatePath('/platform/agencies')
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete agency' }
  }
}
