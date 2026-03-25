'use server'

import { redirect } from 'next/navigation'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { runDesignInstaller } from '@/lib/designInstaller/runDesignInstaller'

export async function selectDesign(
  installId: string,
  designSlug: string
): Promise<{ error: string } | undefined> {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const supabase = createAdminClient()

  // Verify the install belongs to this user
  const { data: install } = await supabase
    .from('installs')
    .select('id, location_id')
    .eq('id', installId)
    .eq('user_id', user.id)
    .single()

  if (!install) return { error: 'Install not found' }

  const { error } = await supabase
    .from('installs')
    .update({ design_slug: designSlug, configured: false })
    .eq('id', installId)

  if (error) return { error: error.message }

  // Kick off installer (fire-and-forget)
  runDesignInstaller(install.location_id, designSlug).catch((err) =>
    console.error('[selectDesign] installer failed:', err)
  )

  redirect(`/designs/${designSlug}/dashboard?locationId=${install.location_id}`)
}
