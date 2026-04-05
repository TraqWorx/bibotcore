import SimfoniaPageHeader from '@/app/designs/simfonia/_components/SimfoniaPageHeader'
import ContactsPageClient from '@/app/designs/simfonia/contacts/_components/ContactsPageClient'
import ConversationsClient from '@/app/designs/simfonia/conversations/_components/ConversationsClient'
import PipelineClient from '@/app/designs/simfonia/pipeline/_components/PipelineClient'
import WeekCalendar from '@/app/designs/simfonia/calendar/WeekCalendar'
import SettingsTabs from '@/app/designs/simfonia/settings/_components/SettingsTabs'
import ThemeForm from '@/app/designs/simfonia/settings/_components/ThemeForm'
import ClosedDaysForm from '@/app/designs/simfonia/settings/_components/ClosedDaysForm'
import AiReceptionistToggle from '@/app/designs/simfonia/settings/_components/AiReceptionistToggle'
import TargetForm from '@/app/designs/simfonia/settings/_components/TargetForm'
import GareForm from '@/app/designs/simfonia/settings/_components/GareForm'
import ProvvigioniForm from '@/app/designs/simfonia/settings/_components/ProvvigioniForm'
import AvailabilityForm from '@/app/designs/simfonia/settings/_components/AvailabilityForm'
import TeamManager from '@/app/designs/simfonia/settings/_components/TeamManager'
import PortalSettingsForm from '@/app/designs/simfonia/settings/_components/PortalSettingsForm'
import { sf } from '@/lib/simfonia/ui'
import {
  demoCalendarEvents,
  demoCalendarUsers,
  demoCategories,
  demoContactColumns,
  demoContactCustomFields,
  demoContacts,
  demoConversationMessages,
  demoConversations,
  demoConversationUsers,
  demoCurrentUserEmail,
  demoPipelines,
  demoWorkflows,
  demoContactNotesByContact,
  demoOpportunities,
} from '../_lib/demoData'

export function DemoContactsView() {
  return (
    <ContactsPageClient
      locationId="demo-simfonia"
      columns={demoContactColumns}
      customFields={demoContactCustomFields}
      categories={demoCategories}
      allTags={['fibra', 'telefonia', 'energia', 'connettivita', 'tv']}
      gestoreOptions={[]}
      categoryTags={{}}
      activeCategory={null}
      activeTag={null}
      activeGestore={null}
      dateFrom={null}
      dateTo={null}
      scadenzaFrom={null}
      scadenzaTo={null}
      search={null}
      categoryLabels={[]}
      categoriaFieldId="cf-categoria"
      gestoreFieldId={null}
      scadenzaFieldIds={[]}
      activeCategoryLabel={null}
      demoContacts={demoContacts}
      demoMode
    />
  )
}

export function DemoConversationsView() {
  return (
    <ConversationsClient
      locationId="demo-simfonia"
      demoMode
      demoData={{
        conversations: demoConversations,
        users: demoConversationUsers,
        currentUserEmail: demoCurrentUserEmail,
        messagesByConversation: demoConversationMessages,
        notesByContact: demoContactNotesByContact,
      }}
    />
  )
}

export function DemoPipelineView() {
  return (
    <PipelineClient
      locationId="demo-simfonia"
      demoPipelines={demoPipelines}
      demoOpportunities={demoOpportunities}
      demoMode
    />
  )
}

export function DemoCalendarView() {
  return (
    <div className="space-y-7">
      <SimfoniaPageHeader
        eyebrow="Agenda"
        title="Calendario"
        description={
          <>
            <span className="font-semibold text-gray-800">{demoCalendarEvents.length}</span> appuntamenti in cache per questa location.
          </>
        }
        actions={
          <span className={sf.primaryBtn}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nuovo appuntamento
          </span>
        }
      />

      <div className={`${sf.card} p-4 sm:p-5`}>
        <WeekCalendar
          events={demoCalendarEvents}
          users={demoCalendarUsers}
          isAdmin
          currentUserId={demoCalendarUsers[0]?.id ?? null}
        />
      </div>
    </div>
  )
}

export function DemoAutomationsView() {
  const active = demoWorkflows.filter((w) => w.status === 'published' || w.status === 'active')
  const draft = demoWorkflows.filter((w) => w.status === 'draft')

  return (
    <div className="space-y-8">
      <SimfoniaPageHeader
        eyebrow="Workflow"
        title="Automazioni"
        description="Stato dei workflow GoHighLevel collegati a questa location (sola lettura)."
      />

      {demoWorkflows.length === 0 ? (
        <div className={`${sf.card} ${sf.cardPadding} text-center`}>
          <p className="text-sm text-gray-500">Nessun workflow trovato. Crealo e pubblicalo da Bibot.</p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div className={`${sf.card} overflow-hidden p-0 shadow-md`}>
              <div className="border-b border-gray-200/80 bg-gray-50/80 px-5 py-3.5 backdrop-blur-sm">
                <h2 className={sf.sectionLabel}>Attivi ({active.length})</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {active.map((w) => (
                  <div key={w.id} className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50">
                        <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                        </svg>
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{w.name}</p>
                        {w.version ? <p className="text-[10px] text-gray-400">v{w.version}</p> : null}
                      </div>
                    </div>
                    <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-[11px] font-semibold text-green-700">Attivo</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {draft.length > 0 && (
            <div className={`${sf.card} overflow-hidden p-0 shadow-md`}>
              <div className="border-b border-gray-200/80 bg-gray-50/80 px-5 py-3.5 backdrop-blur-sm">
                <h2 className={sf.sectionLabel}>Bozze ({draft.length})</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {draft.map((w) => (
                  <div key={w.id} className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50">
                        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                        </svg>
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-500">{w.name}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-500">Bozza</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className={`${sf.cardMuted} px-5 py-4`}>
        <p className="text-xs leading-relaxed text-gray-500">
          Le automazioni si gestiscono in Bibot. Qui vedi solo uno snapshot dello stato.
        </p>
      </div>
    </div>
  )
}

export function DemoSettingsView() {
  const tabs = [
    {
      id: 'generale',
      label: 'Generale',
      content: (
        <div className="space-y-6">
          <ThemeForm
            locationId="demo-simfonia"
            primaryColor="#151411"
            secondaryColor="#8BC53F"
            logoUrl="/brands/simfonia-logo.png"
            demoMode
          />
          <ClosedDaysForm locationId="demo-simfonia" initialDays={['2026-04-25', '2026-05-01']} demoMode />
          <AiReceptionistToggle locationId="demo-simfonia" initialEnabled demoMode />
        </div>
      ),
    },
    {
      id: 'obiettivi',
      label: 'Obiettivi',
      content: (
        <div className="space-y-6">
          <TargetForm locationId="demo-simfonia" currentTarget={1900} demoMode />
          <div className={sf.formCard}>
            <h2 className={sf.formTitle}>Gare mensili</h2>
            <p className={`${sf.formDesc} mb-5`}>Imposta gli obiettivi mensili per operatore/categoria.</p>
            <GareForm
              locationId="demo-simfonia"
              month="2026-04-01"
              initialRows={[
                { categoria: 'Telefonia', tag: 'telefonia', obiettivo: 80 },
                { categoria: 'Energia', tag: 'energia', obiettivo: 65 },
              ]}
              gestoriOptions={['Telefonia', 'Energia', 'Connettivita', 'TV']}
              demoMode
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
            <div className="flex flex-wrap gap-2">
              {['fibra', 'telefonia', 'energia', 'connettivita', 'tv'].map((tag) => (
                <span key={tag} className="rounded-full border border-brand/20 bg-brand/5 px-3 py-1 text-xs font-semibold text-brand">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div className={sf.formCard}>
            <h2 className={sf.formTitle}>Tag per categoria</h2>
            <p className={`${sf.formDesc} mb-5`}>Associa tag alle categorie per filtri e creazione contatti.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {['Telefonia', 'Energia', 'Connettivita', 'Intrattenimento'].map((category) => (
                <div key={category} className="rounded-2xl border border-[var(--shell-line)] bg-[var(--shell-canvas)] p-4">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{category}</p>
                  <p className="mt-2 text-xs text-[var(--shell-muted)]">Tag demo collegati alla categoria.</p>
                </div>
              ))}
            </div>
          </div>
          <div className={sf.formCard}>
            <h2 className={sf.formTitle}>Campi univoci</h2>
            <p className={`${sf.formDesc} mb-5`}>Campi che devono avere valori unici tra i contatti.</p>
            <div className="flex flex-wrap gap-2">
              {['POD', 'PDR', 'Codice cliente'].map((item) => (
                <span key={item} className="rounded-full border border-[var(--shell-line)] bg-[var(--shell-soft)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                  {item}
                </span>
              ))}
            </div>
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
          <ProvvigioniForm
            locationId="demo-simfonia"
            initialRows={[
              { nome: 'Gettone Energia', tipo: 'fisso', valore: 55, ordine: 0 },
              { nome: 'Upsell Fibra', tipo: 'percentuale', valore: 8, ordine: 1 },
            ]}
            demoMode
          />
        </div>
      ),
    },
    {
      id: 'calendario',
      label: 'Calendario',
      content: (
        <AvailabilityForm
          locationId="demo-simfonia"
          users={demoCalendarUsers}
          initialSlots={demoCalendarUsers.flatMap((user) =>
            Array.from({ length: 7 }, (_, day) => ({
              ghl_user_id: user.id,
              day_of_week: day,
              start_time: '09:00',
              end_time: '18:00',
              enabled: day < 5,
            }))
          )}
          demoMode
        />
      ),
    },
    {
      id: 'team',
      label: 'Team',
      content: <TeamManager locationId="demo-simfonia" demoMode demoUsers={demoConversationUsers.map((user, index) => ({ userId: user.id, email: user.email, role: index === 0 ? 'location_admin' : 'team_member' }))} />,
    },
    {
      id: 'portale',
      label: 'Portale Clienti',
      content: (
        <PortalSettingsForm
          locationId="demo-simfonia"
          portalUrl="https://demo.bibotcrm.it/portal/demo-simfonia"
          initialIconUrl="/brands/simfonia-logo.png"
          initialWelcomeMessage="Benvenuto! Accedi al tuo portale clienti per visualizzare i tuoi dati."
          initialAutoInvite
          demoMode
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
