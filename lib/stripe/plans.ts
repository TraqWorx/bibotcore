export const PLAN = {
  name: 'Bibot CRM',
  id: 'pro' as const,
  priceId: process.env.STRIPE_PRO_PRICE_ID ?? '',
  currency: 'gbp' as const,
  priceCents: 12000,
  priceLabel: '£120/mo',
  features: [
    'Full Bibot CRM (contacts, pipeline, calendar, conversations, team)',
    'Dashboard builder module — create & share client dashboards',
    'GHL data sync',
    'Custom widgets, colors, and branding',
    'Embeddable share link for clients',
  ],
}

export type PlanId = 'pro'
