'use server'

import { revalidatePath } from 'next/cache'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { isBibotAgency } from '@/lib/isBibotAgency'
import { currentPeriod } from '@/lib/apulia/fields'

async function ensureOwner(): Promise<{ email: string } | { error: string }> {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id, role').eq('id', user.id).single()
  if (profile?.role === 'super_admin') return { email: user.email ?? '' }
  if (!profile?.agency_id || !isBibotAgency(profile.agency_id)) return { error: 'Forbidden' }
  if (profile.role !== 'admin') return { error: 'Forbidden' }
  return { email: user.email ?? '' }
}

/**
 * Bulk Paga — record a payment row for every selected admin in one shot.
 * Idempotent: re-marking already-paid admins is a no-op (unique on contact+period).
 */
export async function bulkMarkPaid(adminContactIds: string[], amounts: Record<string, number>): Promise<{ paid: number; skipped: number; error?: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return { paid: 0, skipped: 0, error: guard.error }
  const sb = createAdminClient()
  const period = currentPeriod()

  // Find admins already paid for this period — those are "skipped".
  const { data: existing } = await sb.from('apulia_payments')
    .select('contact_id')
    .eq('period', period)
    .in('contact_id', adminContactIds)
  const alreadyPaid = new Set((existing ?? []).map((r) => r.contact_id))
  const toInsert = adminContactIds
    .filter((id) => !alreadyPaid.has(id))
    .map((id) => ({
      contact_id: id,
      period,
      amount_cents: Math.round((amounts[id] ?? 0) * 100),
      paid_at: new Date().toISOString(),
      paid_by: guard.email,
    }))
    .filter((r) => r.amount_cents > 0)

  if (toInsert.length) {
    const { error } = await sb.from('apulia_payments').insert(toInsert)
    if (error) return { paid: 0, skipped: alreadyPaid.size, error: error.message }
  }

  revalidatePath('/designs/apulia-power/amministratori')
  revalidatePath('/designs/apulia-power/dashboard')
  revalidatePath('/designs/apulia-power/pagamenti')
  return { paid: toInsert.length, skipped: alreadyPaid.size }
}
