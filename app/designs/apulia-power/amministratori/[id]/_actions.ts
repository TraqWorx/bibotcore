'use server'

import { revalidatePath } from 'next/cache'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { isBibotAgency } from '@/lib/isBibotAgency'
import { ghlFetch } from '@/lib/apulia/ghl'
import { APULIA_FIELD, currentPeriod } from '@/lib/apulia/fields'
import { recomputeCommissions } from '@/lib/apulia/recompute'

async function ensureOwner(): Promise<{ email: string } | { error: string }> {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id, role').eq('id', user.id).single()
  if (!profile?.agency_id || !isBibotAgency(profile.agency_id)) return { error: 'Forbidden' }
  if (profile.role !== 'admin' && profile.role !== 'super_admin') return { error: 'Forbidden' }
  return { email: user.email ?? '' }
}

export async function setPodOverride(podContactId: string, amount: number, adminContactId: string): Promise<{ error: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return guard

  // Send empty string to clear, otherwise the number.
  const value = amount > 0 ? amount : ''
  const r = await ghlFetch(`/contacts/${podContactId}`, {
    method: 'PUT',
    body: JSON.stringify({ customFields: [{ id: APULIA_FIELD.POD_OVERRIDE, value }] }),
  })
  if (!r.ok) return { error: `GHL ${r.status}: ${(await r.text()).slice(0, 200)}` }

  // Recompute the affected admin's total. Cheap relative to a full pass.
  await recomputeCommissions().catch((err) => console.error('[setPodOverride] recompute:', err))

  revalidatePath(`/designs/apulia-power/amministratori/${adminContactId}`)
  revalidatePath('/designs/apulia-power/amministratori')
  revalidatePath('/designs/apulia-power/dashboard')
}

export async function markPaid(adminContactId: string, amountCents: number, note?: string): Promise<{ error: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return guard

  const sb = createAdminClient()
  const { error } = await sb.from('apulia_payments').upsert({
    contact_id: adminContactId,
    period: currentPeriod(),
    amount_cents: amountCents,
    paid_at: new Date().toISOString(),
    paid_by: guard.email,
    note: note ?? null,
  }, { onConflict: 'contact_id,period' })

  if (error) return { error: error.message }

  revalidatePath(`/designs/apulia-power/amministratori/${adminContactId}`)
  revalidatePath('/designs/apulia-power/amministratori')
  revalidatePath('/designs/apulia-power/pagamenti')
}

export async function unmarkPaid(adminContactId: string): Promise<{ error: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return guard

  const sb = createAdminClient()
  const { error } = await sb
    .from('apulia_payments')
    .delete()
    .eq('contact_id', adminContactId)
    .eq('period', currentPeriod())

  if (error) return { error: error.message }

  revalidatePath(`/designs/apulia-power/amministratori/${adminContactId}`)
  revalidatePath('/designs/apulia-power/amministratori')
  revalidatePath('/designs/apulia-power/pagamenti')
}
