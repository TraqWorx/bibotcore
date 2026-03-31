'use server'

import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { assertUserOwnsLocation } from '@/lib/location/getActiveLocation'
import { summarizeContact, suggestReply, generateInsight, getAiUsageStats } from './claude'

/**
 * Server action: Generate a contact summary.
 */
export async function aiSummarizeContact(
  locationId: string,
  contactGhlId: string,
): Promise<{ summary?: string; error?: string }> {
  try {
    await assertUserOwnsLocation(locationId)

    const authClient = await createAuthClient()
    const { data: { user } } = await authClient.auth.getUser()

    const sb = createAdminClient()

    // Fetch contact from cache
    const [{ data: contact }, { data: customFields }, { data: opportunities }, { data: fieldDefs }] = await Promise.all([
      sb.from('cached_contacts').select('*').eq('location_id', locationId).eq('ghl_id', contactGhlId).single(),
      sb.from('cached_contact_custom_fields').select('field_id, value').eq('location_id', locationId).eq('contact_ghl_id', contactGhlId),
      sb.from('cached_opportunities').select('name, status, monetary_value').eq('location_id', locationId).eq('contact_ghl_id', contactGhlId),
      sb.from('cached_custom_fields').select('field_id, name').eq('location_id', locationId),
    ])

    if (!contact) return { error: 'Contatto non trovato' }

    const fieldNameMap = new Map((fieldDefs ?? []).map((f) => [f.field_id, f.name ?? '']))

    const summary = await summarizeContact(locationId, user?.id ?? null, {
      name: [contact.first_name, contact.last_name].filter(Boolean).join(' '),
      email: contact.email,
      phone: contact.phone,
      tags: contact.tags ?? [],
      customFields: (customFields ?? [])
        .filter((cf) => cf.value)
        .map((cf) => ({ name: fieldNameMap.get(cf.field_id) ?? cf.field_id, value: cf.value! })),
      opportunities: (opportunities ?? []).map((o) => ({
        name: o.name ?? 'Deal',
        status: o.status ?? 'open',
        value: Number(o.monetary_value) || 0,
      })),
    })

    return { summary }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Errore AI' }
  }
}

/**
 * Server action: Suggest a reply for a conversation.
 */
export async function aiSuggestReply(
  locationId: string,
  contactGhlId: string,
  conversationType: string,
  recentMessages: { direction: string; body: string }[],
): Promise<{ reply?: string; error?: string }> {
  try {
    await assertUserOwnsLocation(locationId)

    const authClient = await createAuthClient()
    const { data: { user } } = await authClient.auth.getUser()

    const sb = createAdminClient()
    const { data: contact } = await sb
      .from('cached_contacts')
      .select('first_name, last_name')
      .eq('location_id', locationId)
      .eq('ghl_id', contactGhlId)
      .single()

    const contactName = contact
      ? [contact.first_name, contact.last_name].filter(Boolean).join(' ')
      : 'Cliente'

    const reply = await suggestReply(locationId, user?.id ?? null, {
      contactName,
      conversationType,
      recentMessages,
    })

    return { reply }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Errore AI' }
  }
}

/**
 * Server action: Get analytics insight.
 */
export async function aiGenerateInsight(
  locationId: string,
  question: string,
): Promise<{ insight?: string; error?: string }> {
  try {
    await assertUserOwnsLocation(locationId)

    const authClient = await createAuthClient()
    const { data: { user } } = await authClient.auth.getUser()

    const sb = createAdminClient()

    const [{ count: totalContacts }, { data: opportunities }] = await Promise.all([
      sb.from('cached_contacts').select('*', { count: 'exact', head: true }).eq('location_id', locationId),
      sb.from('cached_opportunities').select('name, status, monetary_value').eq('location_id', locationId).limit(20),
    ])

    // Get category breakdown from custom fields
    const { data: fieldDefs } = await sb
      .from('cached_custom_fields')
      .select('field_id, name')
      .eq('location_id', locationId)
      .ilike('name', 'Categoria')
      .limit(1)

    let categories: { label: string; count: number }[] = []
    if (fieldDefs && fieldDefs.length > 0) {
      const { data: cfValues } = await sb
        .from('cached_contact_custom_fields')
        .select('value')
        .eq('location_id', locationId)
        .eq('field_id', fieldDefs[0].field_id)

      const catCounts = new Map<string, number>()
      for (const row of cfValues ?? []) {
        for (const cat of (row.value ?? '').split(',').map((s: string) => s.trim()).filter(Boolean)) {
          catCounts.set(cat, (catCounts.get(cat) ?? 0) + 1)
        }
      }
      categories = Array.from(catCounts.entries()).map(([label, count]) => ({ label, count }))
    }

    const insight = await generateInsight(locationId, user?.id ?? null, question, {
      totalContacts: totalContacts ?? 0,
      categories,
      recentDeals: (opportunities ?? []).map((o) => ({
        name: o.name ?? 'Deal',
        status: o.status ?? 'open',
        value: Number(o.monetary_value) || 0,
      })),
    })

    return { insight }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Errore AI' }
  }
}

/**
 * Server action: Get AI usage stats for a location.
 */
export async function getAiStats(locationId: string) {
  try {
    await assertUserOwnsLocation(locationId)
    return await getAiUsageStats(locationId)
  } catch {
    return { monthlyLimit: 0, tokensUsed: 0, currentMonth: '', recentRequests: [] }
  }
}
