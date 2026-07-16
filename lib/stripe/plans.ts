export type PlanId = 'launch' | 'growth'

export interface Plan {
  id: PlanId
  name: string
  priceId: string
  currency: 'gbp'
  priceCents: number
  priceLabel: string
  features: string[]
}

const FEATURES = [
  'Full CRM (contacts, pipeline, calendar, conversations, team)',
  'Dashboard builder module \u2014 create & share client dashboards',
  'GHL data sync',
  'Custom widgets, colors, and branding',
  'Embeddable share link for clients',
]

export const PLANS: Record<PlanId, Plan> = {
  launch: {
    id: 'launch',
    name: 'Launch',
    priceId: process.env.STRIPE_PRICE_LAUNCH ?? '',
    currency: 'gbp',
    priceCents: 5000,
    priceLabel: '\u00a350/mo',
    features: FEATURES,
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    priceId: process.env.STRIPE_PRICE_GROWTH ?? '',
    currency: 'gbp',
    priceCents: 15000,
    priceLabel: '\u00a3150/mo',
    features: FEATURES,
  },
}

export const PLAN_LIST: Plan[] = [PLANS.launch, PLANS.growth]

// Fallback for manual/legacy activation paths that do not specify a plan.
export const DEFAULT_PLAN: Plan = PLANS.launch

export function getPlan(id: string | null | undefined): Plan | undefined {
  return id && id in PLANS ? PLANS[id as PlanId] : undefined
}
