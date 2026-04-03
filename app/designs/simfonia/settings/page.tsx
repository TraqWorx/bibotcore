import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase-server'
import { getActiveLocation } from '@/lib/location/getActiveLocation'
import { DEFAULT_THEME, type DesignTheme } from '@/lib/types/design'
import { getCategoryTags, getClosedDays, getGareMensili, getLocationTags, getProvvigioni, getUserAvailability, getUniqueFields } from './_actions'
import { getCustomFieldDefs } from '@/lib/data/contacts'
import {
  discoverCategories,
  getProviderField,
  type CustomFieldDef,
} from '@/lib/utils/categoryFields'
import SettingsTabs from './_components/SettingsTabs'
import TargetForm from './_components/TargetForm'
import GareForm from './_components/GareForm'
import ProvvigioniForm from './_components/ProvvigioniForm'
import AvailabilityForm from './_components/AvailabilityForm'
import TagsManager from './_components/TagsManager'
import CategoryTagsForm from './_components/CategoryTagsForm'
import ThemeForm from './_components/ThemeForm'
import ClosedDaysForm from './_components/ClosedDaysForm'
import UniqueFieldsForm from './_components/UniqueFieldsForm'
import TeamManager from './_components/TeamManager'
import PortalSettingsForm from './_components/PortalSettingsForm'
import AiReceptionistToggle from './_components/AiReceptionistToggle'
import SimfoniaPageHeader from '../_components/SimfoniaPageHeader'
import { sf } from '@/lib/simfonia/ui'

interface GhlUser {
  id: string
  name: string
  email: string
}

async function fetchGhlUsers(locationId: string): Promise<GhlUser[]> {
  const sb = createAdminClient()
  const { data: cached } = await sb
    .from('cached_ghl_users')
    .select('ghl_id, name, first_name, last_name, email')
    .eq('location_id', locationId)
  if (!cached || cached.length === 0) return []
  return cached.map((u) => ({
    id: u.ghl_id,
    name: u.name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.ghl_id,
    email: u.email ?? '',
  }))
}

/** Collect all gestore picklist options across all categories */
function getAllGestoreOptions(customFields: CustomFieldDef[], categories: { label: string }[]): string[] {
  const allOptions = new Set<string>()
  for (const cat of categories) {
    const pf = getProviderField(customFields, cat.label)
    if (pf?.picklistOptions) {
      for (const opt of pf.picklistOptions) allOptions.add(opt)
    }
  }
  return Array.from(allOptions).sort()
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const locationId = await getActiveLocation(sp).catch(() => null)

  if (!locationId) redirect('/designs/simfonia/dashboard')

  const supabase = createAdminClient()
  const currentMonth = getCurrentMonth()

  const [settingsRes, themeRes, gareRows, locationTags, provvigioniRows, availabilitySlots, ghlUsers, customFields, categoryTagsMap, closedDays, uniqueFieldIds] = await Promise.all([
    supabase
      .from('location_settings')
      .select('target_annuale, portal_icon_url, portal_welcome_message, portal_auto_invite, ai_receptionist')
      .eq('location_id', locationId)
      .single(),
    supabase
      .from('location_design_settings')
      .select('theme_overrides')
      .eq('location_id', locationId)
      .single(),
    getGareMensili(locationId, currentMonth),
    getLocationTags(locationId),
    getProvvigioni(locationId),
    getUserAvailability(locationId),
    fetchGhlUsers(locationId),
    getCustomFieldDefs(locationId),
    getCategoryTags(locationId).catch(() => ({} as Record<string, string[]>)),
    getClosedDays(locationId),
    getUniqueFields(locationId),
  ])

  const ghlTagsWithIds = locationTags.map((t) => ({ id: t.id, name: t.name }))
  const categories = discoverCategories(customFields)
  const gestoriOptions = getAllGestoreOptions(customFields, categories)

  const currentTarget = settingsRes.data?.target_annuale ?? 1900
  const overrides = (themeRes.data?.theme_overrides ?? {}) as Partial<DesignTheme>

  const tabs = [
    {
      id: 'generale',
      label: 'Generale',
      content: (
        <div className="space-y-6">
          <ThemeForm
            locationId={locationId}
            primaryColor={overrides.primaryColor ?? DEFAULT_THEME.primaryColor}
            secondaryColor={overrides.secondaryColor ?? DEFAULT_THEME.secondaryColor}
            logoUrl={overrides.logoUrl ?? ''}
          />
          <ClosedDaysForm locationId={locationId} initialDays={closedDays} />
          <AiReceptionistToggle locationId={locationId} initialEnabled={(settingsRes.data as Record<string, unknown>)?.ai_receptionist as boolean ?? false} />
        </div>
      ),
    },
    {
      id: 'obiettivi',
      label: 'Obiettivi',
      content: (
        <div className="space-y-6">
          <TargetForm locationId={locationId} currentTarget={currentTarget} />
          <div className={sf.formCard}>
            <h2 className={sf.formTitle}>Gare mensili</h2>
            <p className={`${sf.formDesc} mb-5`}>
              Imposta gli obiettivi mensili per operatore/categoria.
            </p>
            <GareForm
              locationId={locationId}
              month={currentMonth}
              initialRows={gareRows}
              gestoriOptions={gestoriOptions}
            />
          </div>
        </div>
      ),
    },
    {
      id: 'contatti',
      label: 'Contatti',
      content: (
        <div className="space-y-6">
          <div className={sf.formCard}>
            <h2 className={sf.formTitle}>Tag</h2>
            <p className={`${sf.formDesc} mb-5`}>Gestisci i tag per questa location.</p>
            <TagsManager locationId={locationId} initialTags={locationTags} />
          </div>
          <div className={sf.formCard}>
            <h2 className={sf.formTitle}>Tag per categoria</h2>
            <p className={`${sf.formDesc} mb-5`}>Associa tag alle categorie per filtri e creazione contatti.</p>
            <CategoryTagsForm locationId={locationId} categories={categories} allTags={ghlTagsWithIds} initialCategoryTags={categoryTagsMap} />
          </div>
          <div className={sf.formCard}>
            <h2 className={sf.formTitle}>Campi univoci</h2>
            <p className={`${sf.formDesc} mb-5`}>Campi che devono avere valori unici tra i contatti (es. POD, PDR).</p>
            <UniqueFieldsForm locationId={locationId} customFields={customFields} initialUniqueFieldIds={uniqueFieldIds} />
          </div>
        </div>
      ),
    },
    {
      id: 'provvigioni',
      label: 'Provvigioni',
      content: (
        <div className={sf.formCard}>
          <h2 className={sf.formTitle}>Calcolatore provvigioni</h2>
          <p className={`${sf.formDesc} mb-5`}>Configura i tipi di provvigione con importo fisso o percentuale.</p>
          <ProvvigioniForm locationId={locationId} initialRows={provvigioniRows} />
        </div>
      ),
    },
    {
      id: 'calendario',
      label: 'Calendario',
      content: (
        <AvailabilityForm locationId={locationId} users={ghlUsers.map((u) => ({ id: u.id, name: u.name }))} initialSlots={availabilitySlots} />
      ),
    },
    {
      id: 'team',
      label: 'Team',
      content: <TeamManager locationId={locationId} />,
    },
    {
      id: 'portale',
      label: 'Portale Clienti',
      content: (
        <PortalSettingsForm
          locationId={locationId}
          portalUrl={`${process.env.NEXT_PUBLIC_APP_URL ?? 'https://core.bibotcrm.it'}/portal/${locationId}`}
          initialIconUrl={(settingsRes.data as Record<string, unknown>)?.portal_icon_url as string ?? ''}
          initialWelcomeMessage={(settingsRes.data as Record<string, unknown>)?.portal_welcome_message as string ?? 'Benvenuto! Accedi al tuo portale clienti per visualizzare i tuoi dati.'}
          initialAutoInvite={(settingsRes.data as Record<string, unknown>)?.portal_auto_invite as boolean ?? false}
        />
      ),
    },
  ]

  return (
    <div className="max-w-4xl space-y-8">
      <SimfoniaPageHeader
        eyebrow="Configurazione"
        title="Impostazioni"
        description="Target, team, portale, tema e regole operative per questa location."
      />

      <SettingsTabs tabs={tabs} />
    </div>
  )
}
