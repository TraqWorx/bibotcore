'use server'

import { revalidatePath } from 'next/cache'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { canWriteBibotDesign } from '@/lib/auth/designOwner'
import { APULIA_LOCATION_ID } from '@/lib/apulia/auth'
import { moveOpportunityStage, syncOpportunities } from '@/lib/apulia/opportunities'

async function ensureOwner(): Promise<{ email: string } | { error: string }> {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id, role, location_id').eq('id', user.id).single()
  if (!(await canWriteBibotDesign(user.id, profile, APULIA_LOCATION_ID))) return { error: 'Forbidden' }
  return { email: user.email ?? '' }
}

export async function moveOpportunity(opportunityId: string, pipelineStageId: string): Promise<{ error?: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return guard
  const r = await moveOpportunityStage(opportunityId, pipelineStageId)
  if (!r.ok) return { error: r.error ?? 'Spostamento fallito' }
  revalidatePath('/designs/apulia-power/opportunita')
}

export async function resyncOpportunities(): Promise<{ pipelines?: number; opportunities?: number; error?: string }> {
  const guard = await ensureOwner()
  if ('error' in guard) return { error: guard.error }
  try {
    const r = await syncOpportunities()
    revalidatePath('/designs/apulia-power/opportunita')
    return r
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'sync failed' }
  }
}
