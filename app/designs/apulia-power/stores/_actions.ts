'use server'

import { revalidatePath } from 'next/cache'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { canWriteBibotDesign } from '@/lib/auth/designOwner'
import { APULIA_LOCATION_ID } from '@/lib/apulia/auth'

async function ensureOwner(): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }
  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id, role, location_id').eq('id', user.id).single()
  if (!(await canWriteBibotDesign(user.id, profile, APULIA_LOCATION_ID))) return { ok: false, error: 'Forbidden' }
  return { ok: true }
}

export async function assignFormToStore(storeId: string, formId: string | null): Promise<{ error?: string } | undefined> {
  const guard = await ensureOwner()
  if (!guard.ok) return { error: guard.error }
  const sb = createAdminClient()
  const { error } = await sb.from('apulia_stores').update({ form_id: formId, updated_at: new Date().toISOString() }).eq('id', storeId)
  if (error) return { error: error.message }
  revalidatePath('/designs/apulia-power/stores')
}

export async function assignCalendarToStore(storeId: string, calendarId: string | null, calendarWidgetSlug: string | null): Promise<{ error?: string } | undefined> {
  const guard = await ensureOwner()
  if (!guard.ok) return { error: guard.error }
  const sb = createAdminClient()
  const { error } = await sb.from('apulia_stores').update({
    calendar_id: calendarId,
    calendar_widget_slug: calendarWidgetSlug,
    updated_at: new Date().toISOString(),
  }).eq('id', storeId)
  if (error) return { error: error.message }
  revalidatePath('/designs/apulia-power/stores')
}
