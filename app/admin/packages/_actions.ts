'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient, createAuthClient } from '@/lib/supabase-server'
import { getInstalledMarketplaceApps } from '@/lib/ghl/marketplace'

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

// Slugify: lowercase, replace spaces/special chars with hyphens
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function syncGhlPackages(): Promise<{ synced: number; error?: string } | undefined> {
  try {
    await assertSuperAdmin()
    const apps = await getInstalledMarketplaceApps()
    if (apps.length === 0) return { synced: 0 }

    const supabase = createAdminClient()

    let synced = 0
    for (const app of apps) {
      const slug = slugify(app.name)
      // Upsert on ghl_app_id — do NOT override price_monthly or status if already set
      const { data: existing } = await supabase
        .from('packages')
        .select('id, price_monthly, status')
        .eq('ghl_app_id', app.appId)
        .maybeSingle()

      if (existing) {
        await supabase
          .from('packages')
          .update({
            name: app.name,
            description: app.description ?? null,
            ghl_version_id: app.versionId ?? null,
          })
          .eq('id', existing.id)
      } else {
        await supabase.from('packages').insert({
          slug,
          name: app.name,
          description: app.description ?? null,
          ghl_app_id: app.appId,
          ghl_version_id: app.versionId ?? null,
          status: 'active',
        })
      }
      synced++
    }

    revalidatePath('/admin/packages')
    return { synced }
  } catch (err) {
    return { synced: 0, error: err instanceof Error ? err.message : 'Sync failed' }
  }
}

export async function createPackage(
  formData: FormData
): Promise<{ error: string } | undefined> {
  try {
    await assertSuperAdmin()
    const supabase = createAdminClient()

    const slug = (formData.get('slug') as string)?.trim()
    const name = (formData.get('name') as string)?.trim()

    if (!slug || !name) return { error: 'Slug and name are required' }

    const priceRaw = (formData.get('price_monthly') as string)?.trim()

    const { error } = await supabase.from('packages').insert({
      slug,
      name,
      description: (formData.get('description') as string)?.trim() || null,
      price_monthly: priceRaw ? Number(priceRaw) : null,
      auto_install: formData.get('auto_install') === 'true',
      auto_apply_design: formData.get('auto_apply_design') === 'true',
      status: (formData.get('status') as string) || 'active',
    })

    if (error) return { error: error.message }
    revalidatePath('/admin/packages')
    redirect('/admin/packages')
  } catch (err) {
    if ((err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw err
    return { error: err instanceof Error ? err.message : 'Failed to create package' }
  }
}

export async function updatePackage(
  slug: string,
  formData: FormData
): Promise<{ error: string } | undefined> {
  try {
    await assertSuperAdmin()
    const supabase = createAdminClient()

    const priceRaw = (formData.get('price_monthly') as string)?.trim()

    const { error } = await supabase
      .from('packages')
      .update({
        description: (formData.get('description') as string)?.trim() || null,
        price_monthly: priceRaw ? Number(priceRaw) : null,
        auto_install: formData.get('auto_install') === 'true',
        auto_apply_design: formData.get('auto_apply_design') === 'true',
        status: (formData.get('status') as string) || 'active',
      })
      .eq('slug', slug)

    if (error) return { error: error.message }
    revalidatePath('/admin/packages')
    redirect('/admin/packages')
  } catch (err) {
    if ((err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw err
    return { error: err instanceof Error ? err.message : 'Failed to update package' }
  }
}

export async function deletePackage(
  id: string
): Promise<{ error: string } | undefined> {
  try {
    await assertSuperAdmin()
    const supabase = createAdminClient()

    // Protect: don't delete if there are installs
    const { count } = await supabase
      .from('installs')
      .select('*', { count: 'exact', head: true })
      .eq('package_slug', id) // id is actually the slug here

    if ((count ?? 0) > 0) {
      return { error: `Cannot delete — ${count} install(s) exist for this package.` }
    }

    const { error } = await supabase.from('packages').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/admin/packages')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete package' }
  }
}

export async function togglePackageField(
  id: string,
  field: 'auto_install' | 'auto_apply_design',
  current: boolean
): Promise<{ error: string } | undefined> {
  try {
    await assertSuperAdmin()
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('packages')
      .update({ [field]: !current })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/admin/packages')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update package' }
  }
}

export async function togglePackageStatus(
  id: string,
  currentStatus: string
): Promise<{ error: string } | undefined> {
  try {
    await assertSuperAdmin()
    const supabase = createAdminClient()
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active'
    const { error } = await supabase
      .from('packages')
      .update({ status: newStatus })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/admin/packages')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update status' }
  }
}
