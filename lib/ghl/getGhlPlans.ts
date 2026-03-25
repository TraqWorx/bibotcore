const BASE_URL = 'https://services.leadconnectorhq.com'

export interface GhlPlan {
  id: string
  name: string
  priceMonthly: number | null
}

/**
 * Fetches agency SaaS plans from GHL.
 *
 * Correct endpoint: GET /saas/agency-plans/:companyId
 * Requires companyId (your GHL Agency Company ID) and an agency-level token.
 *
 * companyId: pass explicitly or set GHL_COMPANY_ID env var
 * token:     pass explicitly or set GHL_AGENCY_TOKEN env var
 */
export async function fetchGhlPlans(
  token?: string,
  companyId?: string,
): Promise<{ plans: GhlPlan[]; raw: unknown }> {
  const resolvedToken = token ?? process.env.GHL_AGENCY_TOKEN
  const resolvedCompanyId = companyId ?? process.env.GHL_COMPANY_ID

  if (!resolvedToken) throw new Error('No agency token. Set GHL_AGENCY_TOKEN env var or pass token.')
  if (!resolvedCompanyId) throw new Error('No company ID. Set GHL_COMPANY_ID env var or pass companyId.')

  const res = await fetch(`${BASE_URL}/saas/agency-plans/${resolvedCompanyId}`, {
    headers: {
      Authorization: `Bearer ${resolvedToken}`,
      Version: '2021-07-28',
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GHL plans API error: ${text}`)
  }

  const data = await res.json()
  const raw: {
    id?: string; planId?: string; name?: string; title?: string
    prices?: { billingInterval?: string; active?: boolean; amount?: number }[]
  }[] = data?.plans ?? data?.data ?? data?.agencyPlans ?? []

  const plans = raw
    .map((p) => {
      const monthlyPrice = p.prices?.find(
        (pr) => pr.billingInterval === 'month' && pr.active !== false
      )
      return {
        id: p.id ?? p.planId ?? '',
        name: p.name ?? p.title ?? '',
        priceMonthly: monthlyPrice?.amount != null ? monthlyPrice.amount / 100 : null,
      }
    })
    .filter((p) => p.id && p.name)

  return { plans, raw: data }
}
