const BASE_URL = 'https://services.leadconnectorhq.com'

export interface GhlSubscription {
  locationId: string
  planId: string
  status: string
  amount?: number
}

/**
 * Fetches active SaaS subscriptions for the agency company.
 * Returns a map of locationId → { planId, status, amount? }
 */
export async function fetchGhlSubscriptions(
  token?: string,
  companyId?: string,
): Promise<GhlSubscription[]> {
  const resolvedToken = token ?? process.env.GHL_AGENCY_TOKEN
  const resolvedCompanyId = companyId ?? process.env.GHL_COMPANY_ID
  if (!resolvedToken || !resolvedCompanyId) return []

  const headers = {
    Authorization: `Bearer ${resolvedToken}`,
    Version: '2021-07-28',
  }

  // GHL SaaS subscriptions endpoint
  const res = await fetch(
    `${BASE_URL}/saas/subscriptions?companyId=${resolvedCompanyId}`,
    { headers, cache: 'no-store' },
  )
  if (!res.ok) return []

  const data = await res.json()

  // Try common response shapes
  const raw: Record<string, unknown>[] =
    data?.subscriptions ?? data?.data ?? data?.items ?? []

  return raw
    .map((s) => ({
      locationId: (s.locationId ?? s.location_id ?? '') as string,
      planId: (s.planId ?? s.plan_id ?? s.ghlPlanId ?? '') as string,
      status: (s.status ?? 'active') as string,
      amount: s.amount != null ? Number(s.amount) : undefined,
    }))
    .filter((s) => s.locationId && s.planId)
}
