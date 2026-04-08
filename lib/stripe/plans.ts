export const PLAN = {
  name: 'GHL Dashboard',
  id: 'pro' as const,
  priceId: process.env.STRIPE_PRO_PRICE_ID ?? '',
  priceCents: 1900,
  priceLabel: '$19/mo',
  features: [
    'Visual drag-and-drop dashboard builder',
    'AI dashboard designer — create any widget',
    'GHL data sync (contacts, pipeline, calendar, team)',
    'Custom widgets, colors, and branding',
    'Embeddable share link for clients',
    'Unlimited widget types',
  ],
}

export type PlanId = 'pro'
