'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

async function getLocationId(): Promise<{ userId: string; locationId: string }> {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const supabase = createAdminClient()
  const { data: install } = await supabase
    .from('installs')
    .select('location_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!install?.location_id) throw new Error('No connected location')
  return { userId: user.id, locationId: install.location_id }
}

export async function createAutomation(
  formData: FormData
): Promise<{ error: string } | undefined> {
  try {
    const { locationId } = await getLocationId()
    const supabase = createAdminClient()

    const name = (formData.get('name') as string)?.trim()
    if (!name) return { error: 'Name is required' }

    const triggerType = formData.get('trigger_type') as string
    if (!triggerType) return { error: 'Trigger is required' }

    let conditions: unknown[] = []
    let actions: unknown[] = []
    try {
      conditions = JSON.parse((formData.get('conditions_json') as string) || '[]')
      actions = JSON.parse((formData.get('actions_json') as string) || '[]')
    } catch {
      return { error: 'Invalid conditions or actions format' }
    }

    if (actions.length === 0) return { error: 'At least one action is required' }

    const { error } = await supabase.from('automations').insert({
      location_id: locationId,
      name,
      trigger_type: triggerType,
      conditions,
      actions,
      active: true,
    })

    if (error) return { error: error.message }
    revalidatePath('/designs/simfonia/automations')
    redirect('/designs/simfonia/automations')
  } catch (err) {
    if ((err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw err
    return { error: err instanceof Error ? err.message : 'Failed to create automation' }
  }
}

export async function updateAutomation(
  id: string,
  formData: FormData
): Promise<{ error: string } | undefined> {
  try {
    const { locationId } = await getLocationId()
    const supabase = createAdminClient()

    const name = (formData.get('name') as string)?.trim()
    if (!name) return { error: 'Name is required' }

    let conditions: unknown[] = []
    let actions: unknown[] = []
    try {
      conditions = JSON.parse((formData.get('conditions_json') as string) || '[]')
      actions = JSON.parse((formData.get('actions_json') as string) || '[]')
    } catch {
      return { error: 'Invalid format' }
    }

    const { error } = await supabase
      .from('automations')
      .update({
        name,
        trigger_type: formData.get('trigger_type') as string,
        conditions,
        actions,
      })
      .eq('id', id)
      .eq('location_id', locationId)

    if (error) return { error: error.message }
    revalidatePath('/designs/simfonia/automations')
    redirect('/designs/simfonia/automations')
  } catch (err) {
    if ((err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw err
    return { error: err instanceof Error ? err.message : 'Failed to update automation' }
  }
}

export async function toggleAutomation(
  id: string,
  active: boolean
): Promise<{ error: string } | undefined> {
  try {
    const { locationId } = await getLocationId()
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('automations')
      .update({ active: !active })
      .eq('id', id)
      .eq('location_id', locationId)
    if (error) return { error: error.message }
    revalidatePath('/designs/simfonia/automations')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to toggle automation' }
  }
}

export async function deleteAutomation(
  id: string
): Promise<{ error: string } | undefined> {
  try {
    const { locationId } = await getLocationId()
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('automations')
      .delete()
      .eq('id', id)
      .eq('location_id', locationId)
    if (error) return { error: error.message }
    revalidatePath('/designs/simfonia/automations')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete automation' }
  }
}
