import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { runAutomations } from '@/lib/automations/runAutomations'
import { runDesignInstaller } from '@/lib/designInstaller/runDesignInstaller'
import { provisionLocation } from '@/lib/ghl/provisionLocation'

/**
 * POST /api/webhooks/ghl
 * Receives inbound GHL webhook events.
 * - location.created: full auto-provision (connection + install + users)
 * - UserDeleted / user.deleted: delete the user from the platform
 * - all events: persisted to ghl_webhook_events and run through automation engine
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const locationId = (body.locationId ?? body.location_id) as string | undefined
  const eventType = (body.type ?? body.event) as string | undefined

  if (!locationId || !eventType) {
    return NextResponse.json({ error: 'Missing locationId or type' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // ── Handle location.created: full provision (same as bulk connect) ────────
  if (eventType === 'location.created') {
    const planId = (body.planId ?? body.plan_id) as string | undefined

    if (planId) {
      const { data: mapping } = await supabase
        .from('plan_design_map')
        .select('design_slug, auto_install')
        .eq('ghl_plan_id', planId)
        .single()

      if (mapping?.auto_install && mapping.design_slug) {
        // Full provision: connection + install + users (non-blocking)
        provisionLocation(locationId, mapping.design_slug)
          .then(() => runDesignInstaller(locationId, mapping.design_slug))
          .catch((err) => console.error('[ghl-webhook] provision failed:', err))

        console.log(`[ghl-webhook] location.created → provisioning ${locationId} with design ${mapping.design_slug}`)
      }
    }
  }

  // ── Handle user removed from location ────────────────────────────────────
  // GHL fires UserDeleted (or user.deleted) when a staff member is removed
  const USER_DELETED_EVENTS = ['UserDeleted', 'user.deleted', 'UserRemoved', 'user.removed']
  if (USER_DELETED_EVENTS.includes(eventType)) {
    // Email may be at body.email, body.data.email, or body.user.email
    const email = (
      (body.email as string | undefined) ??
      ((body.data as Record<string, unknown> | undefined)?.email as string | undefined) ??
      ((body.user as Record<string, unknown> | undefined)?.email as string | undefined)
    )?.toLowerCase()

    if (email) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('email', email)
        .maybeSingle()

      if (profile && profile.role !== 'super_admin') {
        const { error: delErr } = await supabase.auth.admin.deleteUser(profile.id)
        if (delErr) {
          console.error(`[ghl-webhook] deleteUser failed for ${email}:`, delErr.message)
        } else {
          console.log(`[ghl-webhook] UserDeleted → removed ${email} from platform`)
        }
      }
    }
  }

  // ── Persist the raw event ────────────────────────────────────────────────
  const { data: event, error } = await supabase
    .from('ghl_webhook_events')
    .insert({ location_id: locationId, event_type: eventType, payload: body })
    .select('id')
    .single()

  if (error) {
    console.error('[ghl-webhook] Failed to persist event:', error.message)
    return NextResponse.json({ ok: false })
  }

  // ── Fire automation engine (non-blocking) ────────────────────────────────
  runAutomations(locationId, eventType, body, event.id).catch((err) =>
    console.error('[ghl-webhook] runAutomations failed:', err)
  )

  return NextResponse.json({ ok: true })
}
