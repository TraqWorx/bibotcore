export interface CaseStudy {
  slug: string
  name: string
  logo: string
  tagline: string
  intro: string
  did: string[]
  /** Screenshot image paths under /public (e.g. /case-studies/apulia-power/1.png). */
  shots: string[]
}

export const CASE_STUDIES: CaseStudy[] = [
  {
    slug: 'apulia-power',
    name: 'Apulia Power',
    logo: '/apulia-power-logo.webp',
    tagline: 'Database-first CRM for an energy & utilities reseller',
    intro:
      'A full bespoke CRM for an energy/utilities reseller managing thousands of supply points (POD/PDR) across multiple stores and administrators — built database-first, with GoHighLevel kept in sync in the background.',
    did: [
      'Database-first architecture: Supabase is the source of truth, mutations queue and sync to GoHighLevel with retry/backoff — fast UI that never blocks on the CRM API.',
      'Bulk import pipeline for the client’s daily Excel exports (supply points, administrators, switch-outs), auto-skipping report preambles and normalizing stores.',
      'Per-administrator commission engine: per-POD 6-month cycles anchored on the supply start date, a configurable payment rule (supply start, or +30 days), advance payments and forward-only billing.',
      'Switch-out handling that stops commissions from the real execution date without clawing back the already-paid semester.',
      'Stores module with per-store supply-point counts over any date range, plus a payments view (next payment, due/overdue, mark-paid).',
      'Performance pass: RPC-backed aggregates, partial indexes and optimistic inline editing.',
    ],
    shots: [
      '/case-studies/apulia-power/dashboard.png',
      '/case-studies/apulia-power/opportunita.png',
      '/case-studies/apulia-power/import.png',
    ],
  },
  {
    slug: 'apulia-tourism',
    name: 'Apulia Tourism',
    logo: '/brands/apulia-tourism-logo.png',
    tagline: 'Contacts, campaigns & messaging for a tourism operator',
    intro:
      'A focused CRM surface over GoHighLevel for a tourism operator — built around fast contact management and outbound campaigns.',
    did: [
      'Contact management with city/segment filtering and a quick-action contact drawer.',
      'Bulk WhatsApp/SMS drip campaigns with media upload, scheduling and batch throttling.',
      'Template integration so the team sends on-brand messages in a couple of clicks.',
    ],
    shots: [
      '/case-studies/apulia-tourism/shot-1.png',
      '/case-studies/apulia-tourism/shot-2.png',
      '/case-studies/apulia-tourism/shot-3.png',
    ],
  },
  {
    slug: 'simfonia',
    name: 'Simfonia',
    logo: '/brands/simfonia-logo.png',
    tagline: 'White-label CRM for a telephony & energy reseller',
    intro:
      'A fully branded CRM for a telephony & energy services reseller — built around contacts segmented by service, a renewals/leads pipeline, conversations, calendar and automations.',
    did: [
      'Custom-branded shell — the brand’s logo + primary/secondary colours drive the whole theme per location.',
      'Contacts segmented by service category (telephony, energy, home connectivity, entertainment) with tags + filters.',
      'Drag-and-drop sales pipeline for contract renewals and telephony/energy leads.',
      'Conversations, calendar/appointments, automations, and a configurable client portal.',
    ],
    shots: [
      '/case-studies/simfonia/dashboard.png',
      '/case-studies/simfonia/pipeline.png',
      '/case-studies/simfonia/contatti.png',
      '/case-studies/simfonia/impostazioni.png',
    ],
  },
  {
    slug: 'bellessere',
    name: 'Bellessere',
    logo: '/bellessere-logo.png',
    tagline: 'Booking & CRM dashboard for a beauty salon — with an automated waiting list',
    intro:
      'A bespoke, on-brand salon CRM over GoHighLevel — appointments, clients, operators, services and conversations in one dashboard, plus a public booking widget and an automated waiting list that turns cancellations into filled slots.',
    did: [
      'Branded operational dashboard: today/tomorrow agenda, month KPIs (confirmation, attendance and cancellation rates), top clients, operators of the month and most-booked services.',
      'Full CRM surface — week/day calendar with per-operator filtering, appointments with status workflow, client records with history & tags, SMS/WhatsApp conversations, and a services catalogue.',
      'Team management: add or remove operators and set each one’s working hours, synced to the booking availability shown to customers.',
      'Automated waiting list: customers register a preferred service, operator and multiple day/time windows; the invite matches on operator, service duration and time-of-day.',
      'When a booking is cancelled — from the GHL widget, an email/SMS cancel link, or the dashboard — the first compatible person is auto-invited by SMS/WhatsApp with a one-tap deep link straight into that service and operator, drip-fed first-in-line with a hold window.',
      'Cache-first, server-rendered architecture built to scale to 50–70 bookings/day, plus an on-brand public booking widget with a printable QR code for the salon.',
    ],
    // Drop screenshots into public/case-studies/bellessere/ then list them here.
    shots: [],
  },
]

export function getCaseStudy(slug: string): CaseStudy | undefined {
  return CASE_STUDIES.find((c) => c.slug === slug)
}
