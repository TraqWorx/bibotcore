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
    tagline: 'Bespoke translation-agency CRM with a client portal',
    intro:
      'A white-label CRM design for a translation agency, with a branded shell and a token-based client portal.',
    did: [
      'Custom shell theme that derives the full palette from the brand’s primary/secondary colours.',
      'Token-based client portal where contacts view their appointments, invoices and messages — no login friction.',
      'Dashboard with KPIs and trends over cached GoHighLevel data.',
    ],
    shots: [],
  },
]

export function getCaseStudy(slug: string): CaseStudy | undefined {
  return CASE_STUDIES.find((c) => c.slug === slug)
}
