export const PLANS = {
  basic: {
    name: 'Basic Dashboard',
    priceId: process.env.STRIPE_BASIC_PRICE_ID ?? '',
    priceCents: 1000,
    features: ['Pre-built dashboard templates', 'Basic widget set', 'GHL data sync', 'Embed via iframe'],
  },
  pro: {
    name: 'Pro Dashboard',
    priceId: process.env.STRIPE_PRO_PRICE_ID ?? '',
    priceCents: 1900,
    features: ['Everything in Basic', 'AI dashboard designer', 'Full widget library', 'Custom KPIs', 'Custom branding', 'Multiple dashboards'],
  },
} as const

export type PlanId = keyof typeof PLANS
