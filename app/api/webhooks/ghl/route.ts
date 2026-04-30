import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { runDesignInstaller } from '@/lib/designInstaller/runDesignInstaller'
import { provisionLocation } from '@/lib/ghl/provisionLocation'
import { processWebhookEvent } from '@/lib/sync/webhookProcessor'
import { getGhlTokenForLocation } from '@/lib/ghl/getGhlTokenForLocation'

// Per-location custom-field-to-contact-name auto-sync. When a CSV import
// (or any other source) creates a contact with the configured custom field
// populated but no contact name, we copy the field value into firstName.
// Add new locations here as the same convention is applied elsewhere.
const NAME_FROM_CUSTOM_FIELD: Record<string, string> = {
  // Apulia Power → "Cliente" custom field
  'VtNhBfleEQDg0KX4eZqY': 'kgGrpZOgfUZoeTfhs7Ef',
}

/**
 * POST /api/webhooks/ghl
 * Receives inbound GHL webhook events.
 * - CRM entity events: upsert into Supabase cache tables
 * - location.created: full auto-provision (connection + install + users)
 * - UserDeleted / user.deleted: delete the user from the platform
 * - all events: persisted to ghl_webhook_events
 */
export async function POST(req: Request) {
  // ── Authenticate webhook request (mandatory in production) ───────────────
  const webhookSecret = process.env.WEBHOOK_SECRET
  if (!webhookSecret && process.env.NODE_ENV === 'production') {
    console.error('[ghl-webhook] WEBHOOK_SECRET not set in production')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }
  if (webhookSecret) {
    // Check header first, then query param as fallback
    const headerSecret = req.headers.get('x-webhook-secret')
    const url = new URL(req.url)
    const querySecret = url.searchParams.get('secret')
    if (headerSecret !== webhookSecret && querySecret !== webhookSecret) {
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

  // ── Handle user added to location ──────────────────────────────────────
  const USER_CREATED_EVENTS = ['UserCreate', 'user.created', 'UserAdded', 'user.added']
  if (USER_CREATED_EVENTS.includes(eventType)) {
    const email = (
      (body.email as string | undefined) ??
      ((body.data as Record<string, unknown> | undefined)?.email as string | undefined) ??
      ((body.user as Record<string, unknown> | undefined)?.email as string | undefined)
    )?.toLowerCase()

    if (email) {
      // Find or create Supabase user
      let profileId: string | null = null
      const { data: existing } = await supabase.from('profiles').select('id, role').eq('email', email).maybeSingle()

      if (existing) {
        profileId = existing.id
      } else {
        // Create auth user + profile
        const { data: created, error: createErr } = await supabase.auth.admin.createUser({ email, email_confirm: true })
        if (!createErr && created?.user) {
          profileId = created.user.id
          await supabase.from('profiles').upsert({ id: profileId, email, role: 'agency' }, { onConflict: 'id' })
        }
      }

      if (profileId && existing?.role !== 'super_admin') {
        // Link to location + update agency
        await supabase.from('profile_locations').upsert(
          { user_id: profileId, location_id: locationId, role: 'team_member' },
          { onConflict: 'user_id,location_id' },
        )
        // Set agency_id from location
        const { data: loc } = await supabase.from('locations').select('agency_id').eq('location_id', locationId).maybeSingle()
        if (loc?.agency_id) {
          await supabase.from('profiles').update({ agency_id: loc.agency_id }).eq('id', profileId)
        }
        console.log(`[ghl-webhook] UserCreate → added ${email} to ${locationId}`)
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

      if (profile && profile.role !== 'super_admin' && profile.role !== 'admin') {
        // Remove from this location
        await supabase.from('profile_locations').delete().eq('user_id', profile.id).eq('location_id', locationId)
        // Check if user has any other locations
        const { count } = await supabase.from('profile_locations').select('user_id', { count: 'exact', head: true }).eq('user_id', profile.id)
        if ((count ?? 0) === 0) {
          // No locations left — remove user entirely
          await supabase.auth.admin.deleteUser(profile.id)
          console.log(`[ghl-webhook] UserDeleted → removed ${email} from platform (no locations left)`)
        } else {
          console.log(`[ghl-webhook] UserDeleted → unlinked ${email} from ${locationId}`)
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
    .catch(async (err) => {
      console.error(`[ghl-webhook] cache update failed for ${eventType}:`, err)
      // Track failures and notify admin if repeated
      try {
        const sb = createAdminClient()
        // Count recent failures for this location (last hour)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
        const { count } = await sb
          .from('ghl_webhook_events')
          .select('*', { count: 'exact', head: true })
          .eq('location_id', locationId)
          .gte('created_at', oneHourAgo)
          .like('event_type', '%fail%')

        // If 5+ failures in an hour, create a notification for super_admin
        if ((count ?? 0) >= 5) {
          const { data: admins } = await sb.from('profiles').select('id').eq('role', 'super_admin')
          for (const admin of admins ?? []) {
            await Promise.resolve(sb.from('notifications').insert({
              user_id: admin.id,
              type: 'webhook_failure',
              title: `Webhook failures per ${locationId}`,
              body: `${count} webhook processing failures nell'ultima ora. Ultimo errore: ${err instanceof Error ? err.message : String(err)}`,
              read: false,
            })).catch(() => {})
          }
        }
      } catch { /* ignore notification errors */ }
    })

  // ── Cliente → contact Name sync (CSV import auto-mapping) ────────────────
  const CONTACT_EVENTS = ['ContactCreate', 'ContactUpdate']
  if (CONTACT_EVENTS.includes(eventType) && NAME_FROM_CUSTOM_FIELD[locationId]) {
    syncCustomFieldToName(body as ContactWebhookPayload, locationId).catch((err) => {
      console.error('[ghl-webhook] Cliente→Name sync failed:', err)
    })
  }

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

interface ContactWebhookPayload {
  id?: string
  firstName?: string
  lastName?: string
  companyName?: string
  customFields?: { id: string; value?: string }[]
}

/**
 * If the configured custom field on this location has a value AND the
 * contact has no name yet, write the field's value into firstName via
 * GHL's contact PUT endpoint. Lets a CSV column like "Cliente" populate
 * the contact's display name without manual mapping at import time.
 */
async function syncCustomFieldToName(payload: ContactWebhookPayload, locationId: string): Promise<void> {
  const fieldId = NAME_FROM_CUSTOM_FIELD[locationId]
  const contactId = payload.id
  if (!contactId || !fieldId) return

  const cf = (payload.customFields ?? []).find((f) => f.id === fieldId)
  const value = cf?.value?.toString().trim()
  if (!value) return

  // Don't overwrite a contact that already has a name set.
  const hasName = Boolean(
    payload.firstName?.trim() || payload.lastName?.trim() || payload.companyName?.trim()
  )
  if (hasName) return

  const token = await getGhlTokenForLocation(locationId)
  const r = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ firstName: value, locationId }),
  })
  if (!r.ok) {
    console.error(`[Cliente→Name] PUT /contacts/${contactId} -> ${r.status}: ${(await r.text()).slice(0, 200)}`)
  }
}
