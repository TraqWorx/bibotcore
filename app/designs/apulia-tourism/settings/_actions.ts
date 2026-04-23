'use server'

import { createAdminClient } from '@/lib/supabase-server'

export async function getUniqueFields(locationId: string): Promise<string[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('location_settings')
    .select('unique_fields')
    .eq('location_id', locationId)
    .single()
  const fields = (data as { unique_fields?: string[] } | null)?.unique_fields
  return Array.isArray(fields) ? fields : []
}

export async function getCategoryTags(locationId: string): Promise<Record<string, string[]>> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('location_settings')
      .select('category_tags')
      .eq('location_id', locationId)
      .single()
    if (error) return {}
    const tags = (data as { category_tags?: Record<string, string[]> } | null)?.category_tags
    return tags && typeof tags === 'object' ? tags : {}
  } catch {
    return {}
  }
}

export async function ensureCategorySwitchOutFields(locationId: string): Promise<number | null> {
  try {
    const { getGhlClient } = await import('@/lib/ghl/ghlClient')
    const { discoverCategories } = await import('@/lib/utils/categoryFields')
    const ghl = await getGhlClient(locationId)
    const data = await ghl.customFields.list()
    const rawFields = (data?.customFields ?? []) as { id: string; name: string; dataType: string; fieldKey?: string; placeholder?: string; picklistOptions?: string[] }[]
    const fields = rawFields.map((f) => ({ ...f, fieldKey: f.fieldKey ?? f.id }))

    const categories = discoverCategories(fields)
    if (categories.length === 0) return 0

    let created = 0
    for (const cat of categories) {
      const fieldName = `[${cat.label}] Switch Out`
      const existing = fields.find((f) => f.name === fieldName)
      if (existing) continue
      await ghl.customFields.create({
        name: fieldName,
        dataType: 'SINGLE_OPTIONS',
        model: 'contact',
        options: ['Si', 'No'],
      })
      created++
    }
    return created
  } catch (err) {
    console.error('[ensureCategorySwitchOutFields]', err)
    return null
  }
}
