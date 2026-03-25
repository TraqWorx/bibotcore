import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase-server'
import { DEFAULT_THEME, DEFAULT_MODULES, type DesignTheme, type DesignModules } from '@/lib/types/design'
import DesignDefaultsForm from './_components/DesignDefaultsForm'

export default async function DesignSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = createAdminClient()

  const { data: design } = await supabase
    .from('designs')
    .select('name, slug, theme, modules, price_monthly')
    .eq('slug', slug)
    .single()

  if (!design) notFound()

  const theme: DesignTheme = { ...DEFAULT_THEME, ...(design.theme as Partial<DesignTheme> ?? {}) }
  const modules: DesignModules = { ...DEFAULT_MODULES, ...(design.modules as Partial<DesignModules> ?? {}) }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Design</p>
        <h1 className="text-2xl font-bold text-gray-900">{design.name}</h1>
        <p className="mt-0.5 text-sm text-gray-500 font-mono">{slug}</p>
      </div>

      <DesignDefaultsForm slug={slug} name={design.name} theme={theme} modules={modules} priceMonthly={design.price_monthly ?? null} />
    </div>
  )
}
