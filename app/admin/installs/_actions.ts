'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient, createAuthClient } from '@/lib/supabase-server'
import { runDesignInstaller } from '@/lib/designInstaller/runDesignInstaller'

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

  if (profile?.role !== 'super_admin' && profile?.role !== 'admin') throw new Error('Not authorized')
}

export async function retryInstall(
  locationId: string
): Promise<{ error: string } | undefined> {
  try {
    await assertSuperAdmin()
    const supabase = createAdminClient()

    const { data: install } = await supabase
      .from('installs')
      .select('design_slug')
      .eq('location_id', locationId)
      .single()

    if (!install?.design_slug) return { error: 'No design assigned to this location' }

    // Reset status so installer runs fresh
    await supabase
      .from('installs')
      .update({ configured: false, install_status: 'pending', install_log: null, last_error: null })
      .eq('location_id', locationId)

    // Fire-and-forget
    runDesignInstaller(locationId, install.design_slug).catch((err) =>
      console.error('[retryInstall] installer failed:', err)
    )

    revalidatePath('/admin/installs')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to retry install' }
  }
}

export async function activateInstall(
  installId: string,
  locationId: string
): Promise<{ error: string } | undefined> {
  try {
    await assertSuperAdmin()
    const supabase = createAdminClient()

    await Promise.all([
      supabase.from('installs').update({ status: 'active' }).eq('id', installId),
      supabase.from('ghl_connections').update({ status: 'active' }).eq('location_id', locationId),
    ])

    revalidatePath('/admin/installs')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to activate install' }
  }
}
