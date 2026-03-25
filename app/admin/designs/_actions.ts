'use server'

import fs from 'fs'
import path from 'path'
import { revalidatePath } from 'next/cache'
import { createAdminClient, createAuthClient } from '@/lib/supabase-server'

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

export async function createDesign(
  name: string,
  slug: string
): Promise<{ error: string } | undefined> {
  try {
    await assertSuperAdmin()

    const trimmedName = name.trim()
    const trimmedSlug = slug.trim()
    if (!trimmedName) return { error: 'Name is required' }
    if (!trimmedSlug) return { error: 'Slug is required' }
    if (!/^[a-z0-9-]+$/.test(trimmedSlug)) {
      return { error: 'Slug must be lowercase letters, numbers, and hyphens only' }
    }

    const supabase = createAdminClient()

    // Check slug not already taken
    const { data: existing } = await supabase
      .from('designs')
      .select('slug')
      .eq('slug', trimmedSlug)
      .maybeSingle()
    if (existing) return { error: `Slug "${trimmedSlug}" is already in use` }

    const { error: insertError } = await supabase.from('designs').insert({
      slug: trimmedSlug,
      name: trimmedName,
      is_default: false,
      theme: {},
      modules: {},
    })
    if (insertError) return { error: insertError.message }

    // Copy the first available design folder as a starter template
    const designsRoot = path.join(process.cwd(), 'app', 'designs')
    const destFolder = path.join(designsRoot, trimmedSlug)
    if (!fs.existsSync(destFolder)) {
      const entries = fs.existsSync(designsRoot) ? fs.readdirSync(designsRoot) : []
      const templateSlug = entries.find((e) =>
        fs.statSync(path.join(designsRoot, e)).isDirectory()
      )
      if (templateSlug) {
        const srcFolder = path.join(designsRoot, templateSlug)
        fs.cpSync(srcFolder, destFolder, { recursive: true })
        function replaceInDir(dir: string) {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const fullPath = path.join(dir, entry.name)
            if (entry.isDirectory()) {
              replaceInDir(fullPath)
            } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
              const content = fs.readFileSync(fullPath, 'utf8')
              const updated = content.replaceAll(`/designs/${templateSlug}/`, `/designs/${trimmedSlug}/`)
              if (updated !== content) fs.writeFileSync(fullPath, updated, 'utf8')
            }
          }
        }
        replaceInDir(destFolder)
      }
    }

    revalidatePath('/admin/designs')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create design' }
  }
}

export async function duplicateDesign(
  slug: string,
  newSlug: string
): Promise<{ error: string } | undefined> {
  try {
    await assertSuperAdmin()

    const trimmedSlug = newSlug.trim()
    if (!trimmedSlug) return { error: 'New slug is required' }
    if (!/^[a-z0-9-]+$/.test(trimmedSlug)) {
      return { error: 'Slug must be lowercase letters, numbers, and hyphens only' }
    }

    const supabase = createAdminClient()

    // Fetch original design (include theme + modules)
    const { data: original, error: fetchError } = await supabase
      .from('designs')
      .select('name, theme, modules')
      .eq('slug', slug)
      .single()

    if (fetchError || !original) return { error: 'Original design not found' }

    // Insert new design — name defaults to slug (editable later in Settings)
    const { error: insertError } = await supabase.from('designs').insert({
      slug: trimmedSlug,
      name: trimmedSlug,
      is_default: false,
      theme: original.theme ?? {},
      modules: original.modules ?? {},
    })

    if (insertError) return { error: insertError.message }

    // Copy the design's code folder
    const designsRoot = path.join(process.cwd(), 'app', 'designs')
    const srcFolder = path.join(designsRoot, slug)
    const destFolder = path.join(designsRoot, trimmedSlug)

    if (fs.existsSync(srcFolder) && !fs.existsSync(destFolder)) {
      fs.cpSync(srcFolder, destFolder, { recursive: true })

      // Replace all internal path references from old slug to new slug
      function replaceInDir(dir: string) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const fullPath = path.join(dir, entry.name)
          if (entry.isDirectory()) {
            replaceInDir(fullPath)
          } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
            const content = fs.readFileSync(fullPath, 'utf8')
            const updated = content.replaceAll(`/designs/${slug}/`, `/designs/${trimmedSlug}/`)
            if (updated !== content) fs.writeFileSync(fullPath, updated, 'utf8')
          }
        }
      }
      replaceInDir(destFolder)
    }

    revalidatePath('/admin/designs')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to duplicate design' }
  }
}

export async function deleteDesign(
  slug: string
): Promise<{ error: string } | undefined> {
  try {
    await assertSuperAdmin()
    const supabase = createAdminClient()
    const { error } = await supabase.from('designs').delete().eq('slug', slug)
    if (error) return { error: error.message }

    // Also remove the design's code folder
    const designFolder = path.join(process.cwd(), 'app', 'designs', slug)
    if (fs.existsSync(designFolder)) {
      fs.rmSync(designFolder, { recursive: true, force: true })
    }

    revalidatePath('/admin/designs')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete design' }
  }
}
