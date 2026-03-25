'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient, createAuthClient } from '@/lib/supabase-server'
import { fetchGhlPlans } from '@/lib/ghl/getGhlPlans'

async function assertSuperAdmin() {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') throw new Error('Not authorized')
}

export async function createPlanMapping(
  formData: FormData
): Promise<{ error: string } | undefined> {
  try {
    await assertSuperAdmin()

    const ghlPlanId = (formData.get('ghl_plan_id') as string)?.trim()
    const designSlug = (formData.get('design_slug') as string)?.trim()
    const autoInstall = true

    if (!ghlPlanId || !designSlug) {
      return { error: 'Plan and design are required' }
    }

    const supabase = createAdminClient()

    const { data: existing } = await supabase
      .from('ghl_plans')
      .select('ghl_plan_id')
      .eq('ghl_plan_id', ghlPlanId)
      .single()
    if (!existing) return { error: 'Plan not found — sync plans first' }

    // Manual upsert to avoid ON CONFLICT constraint issues
    const { data: existingMap } = await supabase
      .from('plan_design_map')
      .select('id')
      .eq('ghl_plan_id', ghlPlanId)
      .maybeSingle()

    let mapError
    if (existingMap) {
      const { error } = await supabase
        .from('plan_design_map')
        .update({ design_slug: designSlug, auto_install: autoInstall })
        .eq('ghl_plan_id', ghlPlanId)
      mapError = error
    } else {
      const { error } = await supabase
        .from('plan_design_map')
        .insert({ ghl_plan_id: ghlPlanId, design_slug: designSlug, auto_install: autoInstall })
      mapError = error
    }
    if (mapError) return { error: `plan_design_map write: ${mapError.message}` }

    revalidatePath('/admin/plan-mapping')
  } catch (err) {
    console.error('[createPlanMapping] threw:', err)
    return { error: err instanceof Error ? err.message : 'Failed to save mapping' }
  }
}

export async function syncGhlPlans(): Promise<{ synced: number; error?: string } | undefined> {
  try {
    await assertSuperAdmin()
    const { plans } = await fetchGhlPlans()
    if (plans.length === 0) return { synced: 0 }

    const supabase = createAdminClient()
    let synced = 0

    for (const plan of plans) {
      const row: Record<string, unknown> = { ghl_plan_id: plan.id, name: plan.name }
      if (plan.priceMonthly != null) row.price_monthly = plan.priceMonthly
      const { error } = await supabase.from('ghl_plans').upsert(row, { onConflict: 'ghl_plan_id' })
      if (!error) synced++
    }

    revalidatePath('/admin/plan-mapping')
    return { synced }
  } catch (err) {
    return { synced: 0, error: err instanceof Error ? err.message : 'Sync failed' }
  }
}

export async function savePlanPrice(
  ghlPlanId: string,
  priceMonthly: number | null
): Promise<{ error: string } | undefined> {
  try {
    await assertSuperAdmin()
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('ghl_plans')
      .update({ price_monthly: priceMonthly })
      .eq('ghl_plan_id', ghlPlanId)
    if (error) return { error: error.message }
    revalidatePath('/admin/plan-mapping')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save price' }
  }
}

export async function deletePlanMapping(
  ghlPlanId: string
): Promise<{ error: string } | undefined> {
  try {
    await assertSuperAdmin()
    const supabase = createAdminClient()
    // Only delete the mapping, keep the plan in ghl_plans so it stays in the dropdown
    const { error } = await supabase
      .from('plan_design_map')
      .delete()
      .eq('ghl_plan_id', ghlPlanId)
    if (error) return { error: error.message }
    revalidatePath('/admin/plan-mapping')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete mapping' }
  }
}
