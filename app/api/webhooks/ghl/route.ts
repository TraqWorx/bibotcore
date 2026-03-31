import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { runDesignInstaller } from '@/lib/designInstaller/runDesignInstaller'
import { provisionLocation } from '@/lib/ghl/provisionLocation'
import { processWebhookEvent } from '@/lib/sync/webhookProcessor'

/**
 * POST /api/webhooks/ghl
 * Receives inbound GHL webhook events.
 * - CRM entity events: upsert into Supabase cache tables
 * - location.created: full auto-provision (connection + install + users)
 * - UserDeleted / user.deleted: delete the user from the platform
 * - all events: persisted to ghl_webhook_events
 */
export async function POST(req: Request) {
  // ── Authenticate webhook request ────────────────────────────────────────
  const webhookSecret = process.env.WEBHOOK_SECRET
  if (webhookSecret) {
    const url = new URL(req.url)
    const secret = url.searchParams.get('secret')
    if (secret !== webhookSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

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

  // Verify the location exists in our system
  const sb = createAdminClient()
  const { data: conn } = await sb
    .from('ghl_connections')
    .select('location_id')
    .eq('location_id', locationId)
    .limit(1)
    .maybeSingle()
  // Allow location.created even if not yet provisioned
  if (!conn && eventType !== 'location.created') {
    return NextResponse.json({ error: 'Unknown location' }, { status: 403 })
  }

  const supabase = sb

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

  // ── Process CRM entity events into cache (non-blocking) ──────────────────
  processWebhookEvent(locationId, eventType, body)
    .then(({ processed, entity }) => {
      if (processed) {
        console.log(`[ghl-webhook] ${eventType} → cached ${entity} for ${locationId}`)
      }
    })
    .catch((err) => {
      console.error(`[ghl-webhook] cache update failed for ${eventType}:`, err)
    })

  // ── Persist the raw event ────────────────────────────────────────────────
  const { error } = await supabase
    .from('ghl_webhook_events')
    .insert({ location_id: locationId, event_type: eventType, payload: body })
    .select('id')
    .single()

  if (error) {
    console.error('[ghl-webhook] Failed to persist event:', error.message)
    return NextResponse.json({ ok: false })
  }

  return NextResponse.json({ ok: true })
}
