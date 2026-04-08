'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient, createAuthClient } from '@/lib/supabase-server'
import type { DesignTheme, DesignModules } from '@/lib/types/design'

async function assertSuperAdmin() {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const supabase = createAdminClient()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin' && profile?.role !== 'admin') throw new Error('Not authorized')
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/

export async function saveDesignDefaults(
  slug: string,
  name: string,
  theme: DesignTheme,
  modules: DesignModules,
  priceMonthly: number | null = null
): Promise<{ error?: string }> {
  await assertSuperAdmin()

  if (!name.trim()) return { error: 'Nome design richiesto' }
  if (!HEX_RE.test(theme.primaryColor)) return { error: 'Colore primario non valido (usa formato #RRGGBB)' }
  if (!HEX_RE.test(theme.secondaryColor)) return { error: 'Colore secondario non valido (usa formato #RRGGBB)' }
  if (!theme.companyName.trim()) return { error: 'Nome azienda richiesto' }
  if (!theme.logoText.trim() || theme.logoText.length > 3) return { error: 'Logo text deve essere 1-3 caratteri' }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('designs')
    .update({ name: name.trim(), theme, modules, price_monthly: priceMonthly })
    .eq('slug', slug)

  if (error) return { error: error.message }
  revalidatePath('/admin/designs')
  return {}
}
