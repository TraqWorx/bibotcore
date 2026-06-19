'use server'

import { revalidatePath } from 'next/cache'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { isBibotAgency } from '@/lib/isBibotAgency'

async function assertOwner(): Promise<{ error?: string }> {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { error: 'Non autenticato' }
  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id, role').eq('id', user.id).single()
  const isOwner = profile?.role === 'super_admin' || profile?.role === 'admin' || (!!profile?.agency_id && isBibotAgency(profile.agency_id))
  return isOwner ? {} : { error: 'Non autorizzato' }
}

export async function addCategoryMapping(formData: FormData): Promise<{ error?: string }> {
  const guard = await assertOwner()
  if (guard.error) return guard

  const sku = (formData.get('sku') as string | null)?.trim() || null
  const ean = (formData.get('ean') as string | null)?.trim() || null
  const category = (formData.get('category') as string | null)?.trim()
  if (!category) return { error: 'Categoria obbligatoria' }
  if (!sku && !ean) return { error: 'Indica SKU o EAN' }

  const sb = createAdminClient()
  const { error } = await sb
    .from('farmacia_category_map')
    .upsert({ sku, ean, category, updated_at: new Date().toISOString() }, { onConflict: sku ? 'sku' : 'ean' })
  if (error) return { error: error.message }
  revalidatePath('/designs/farmacia-cialdella/settings')
  return {}
}

export async function deleteCategoryMapping(id: string): Promise<{ error?: string }> {
  const guard = await assertOwner()
  if (guard.error) return guard
  const sb = createAdminClient()
  const { error } = await sb.from('farmacia_category_map').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/designs/farmacia-cialdella/settings')
  return {}
}
