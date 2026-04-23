'use server'

import { revalidatePath } from 'next/cache'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

async function getAgencyId(): Promise<string> {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('role, agency_id').eq('id', user.id).single()
  if (profile?.role !== 'admin' && profile?.role !== 'super_admin') throw new Error('Not authorized')
  if (!profile.agency_id) throw new Error('No agency')
  return profile.agency_id
}

export async function addCost(name: string, amount: number, frequency: 'monthly' | 'annual'): Promise<{ error: string } | undefined> {
  try {
    const agencyId = await getAgencyId()
    if (!name.trim()) return { error: 'Name is required' }
    if (amount <= 0) return { error: 'Amount must be greater than 0' }
    const sb = createAdminClient()
    const { error } = await sb.from('agency_costs').insert({ agency_id: agencyId, name: name.trim(), amount, frequency })
    if (error) return { error: error.message }
    revalidatePath('/admin/finances')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to add cost' }
  }
}

export async function updateCost(id: string, name: string, amount: number, frequency: 'monthly' | 'annual'): Promise<{ error: string } | undefined> {
  try {
    const agencyId = await getAgencyId()
    if (!name.trim()) return { error: 'Name is required' }
    if (amount <= 0) return { error: 'Amount must be greater than 0' }
    const sb = createAdminClient()
    const { error } = await sb.from('agency_costs').update({ name: name.trim(), amount, frequency, updated_at: new Date().toISOString() }).eq('id', id).eq('agency_id', agencyId)
    if (error) return { error: error.message }
    revalidatePath('/admin/finances')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update cost' }
  }
}

export async function addVatPayment(amount: number, period: string, notes?: string): Promise<{ error: string } | undefined> {
  try {
    const agencyId = await getAgencyId()
    if (amount <= 0) return { error: 'Amount must be greater than 0' }
    if (!period.trim()) return { error: 'Period is required' }
    const sb = createAdminClient()
    const { error } = await sb.from('vat_payments').insert({ agency_id: agencyId, amount, period: period.trim(), notes: notes?.trim() || null })
    if (error) return { error: error.message }
    revalidatePath('/admin/finances')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to add payment' }
  }
}

export async function deleteVatPayment(id: string): Promise<{ error: string } | undefined> {
  try {
    const agencyId = await getAgencyId()
    const sb = createAdminClient()
    const { error } = await sb.from('vat_payments').delete().eq('id', id).eq('agency_id', agencyId)
    if (error) return { error: error.message }
    revalidatePath('/admin/finances')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete payment' }
  }
}

export async function updateVatQuarterStatus(quarter: string, status: 'pending' | 'paid' | 'partial', amountPaid?: number): Promise<{ error: string } | undefined> {
  try {
    const agencyId = await getAgencyId()
    const sb = createAdminClient()
    const { error } = await sb.from('vat_quarter_status').upsert({
      agency_id: agencyId,
      quarter,
      status,
      amount_paid: amountPaid ?? 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'agency_id,quarter' })
    if (error) return { error: error.message }
    revalidatePath('/admin/finances')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update status' }
  }
}

export async function deleteCost(id: string): Promise<{ error: string } | undefined> {
  try {
    const agencyId = await getAgencyId()
    const sb = createAdminClient()
    const { error } = await sb.from('agency_costs').delete().eq('id', id).eq('agency_id', agencyId)
    if (error) return { error: error.message }
    revalidatePath('/admin/finances')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete cost' }
  }
}
