'use server'

import { revalidatePath } from 'next/cache'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

async function assertAdmin() {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('role, agency_id').eq('id', user.id).single()
  if (profile?.role !== 'super_admin' && profile?.role !== 'admin') throw new Error('Not authorized')
  if (!profile.agency_id) throw new Error('No agency')

  return { userId: user.id, agencyId: profile.agency_id }
}

export async function saveBillingDetails(formData: FormData): Promise<{ error: string } | undefined> {
  try {
    const { agencyId } = await assertAdmin()
    const sb = createAdminClient()

    const updates: Record<string, string | null> = {
      billing_name: (formData.get('billing_name') as string)?.trim() || null,
      billing_email: (formData.get('billing_email') as string)?.trim() || null,
      billing_address_line1: (formData.get('billing_address_line1') as string)?.trim() || null,
      billing_address_line2: (formData.get('billing_address_line2') as string)?.trim() || null,
      billing_city: (formData.get('billing_city') as string)?.trim() || null,
      billing_postal_code: (formData.get('billing_postal_code') as string)?.trim() || null,
      billing_country: (formData.get('billing_country') as string)?.trim() || 'IT',
      billing_vat: (formData.get('billing_vat') as string)?.trim() || null,
      billing_sdi: (formData.get('billing_sdi') as string)?.trim() || null,
      updated_at: new Date().toISOString(),
    }

    const { error } = await sb.from('agencies').update(updates).eq('id', agencyId)
    if (error) return { error: error.message }

    revalidatePath('/admin/account')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save' }
  }
}

export async function saveAgencyName(name: string): Promise<{ error: string } | undefined> {
  try {
    const { agencyId } = await assertAdmin()
    if (!name.trim()) return { error: 'Name is required' }

    const sb = createAdminClient()
    const { error } = await sb.from('agencies').update({ name: name.trim(), updated_at: new Date().toISOString() }).eq('id', agencyId)
    if (error) return { error: error.message }

    revalidatePath('/admin/account')
    revalidatePath('/admin')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save' }
  }
}
