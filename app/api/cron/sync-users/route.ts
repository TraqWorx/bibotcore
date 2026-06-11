import { NextResponse } from 'next/server'
import { syncAllLocationUsers } from '@/lib/sync/syncAllUsers'
import { reconcileBibotUsers } from '@/lib/sync/reconcileBibotUsers'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Cron: sync GHL users into Supabase.
 * 1. syncAllLocationUsers — add new GHL users, prune location-linked removals.
 * 2. reconcileBibotUsers — map GHL role type → platform role, prune phantom
 *    Bibot 'agency' profiles, flag orphan admins (safety-gated, Bibot-scoped).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await syncAllLocationUsers()
    const reconcile = await reconcileBibotUsers()
    console.log('[cron/sync-users]', result, '| reconcile:', reconcile)
    if (reconcile.orphanAdmins.length > 0) {
      console.warn('[cron/sync-users] orphan admins (not in GHL, review manually):', reconcile.orphanAdmins)
    }
    if (reconcile.flaggedPromote.length > 0) {
      console.warn('[cron/sync-users] GHL agency-level, stored as agency (approve to promote):', reconcile.flaggedPromote)
    }
    return NextResponse.json({ ...result, reconcile })
  } catch (err) {
    console.error('[cron/sync-users] error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
