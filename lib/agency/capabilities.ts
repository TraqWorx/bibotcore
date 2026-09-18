import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase-server'

export interface AgencyCapabilities {
  /** Agency-wide GHL token stored: list sub-accounts from GHL, bulk connect, install designs */
  agencyMode: boolean
  /** Runs without the per-location subscription paywall */
  billingExempt: boolean
  /** Has a GHL-connected Stripe account, so Finances has something to read */
  financesEnabled: boolean
  companyId: string | null
}

const NONE: AgencyCapabilities = { agencyMode: false, billingExempt: false, financesEnabled: false, companyId: null }

/**
 * What an agency may do, read from its own row instead of a hardcoded id.
 * Cached per request: several pages ask for this while rendering one page.
 */
export const getAgencyCapabilities = cache(async (agencyId: string | null | undefined): Promise<AgencyCapabilities> => {
  if (!agencyId) return NONE
  const { data } = await createAdminClient()
    .from('agencies')
    .select('ghl_agency_token, ghl_company_id, billing_exempt, ghl_stripe_secret_key')
    .eq('id', agencyId)
    .maybeSingle()
  if (!data) return NONE
  return {
    agencyMode: !!data.ghl_agency_token,
    billingExempt: !!data.billing_exempt,
    financesEnabled: !!data.ghl_stripe_secret_key,
    companyId: data.ghl_company_id ?? null,
  }
})

/** Paywall check in one place: exempt agencies and platform owners always pass. */
export async function isBillingExempt(agencyId: string | null | undefined): Promise<boolean> {
  return (await getAgencyCapabilities(agencyId)).billingExempt
}

export interface AgencyGhlContext {
  token: string | null
  companyId: string | null
}

/**
 * The agency's own GHL credentials. Falls back to the env vars so a single-agency
 * deployment keeps working without a row change.
 */
export const getAgencyGhlContext = cache(async (agencyId: string | null | undefined): Promise<AgencyGhlContext> => {
  if (!agencyId) return { token: process.env.GHL_AGENCY_TOKEN ?? null, companyId: process.env.GHL_COMPANY_ID ?? null }
  const { data } = await createAdminClient()
    .from('agencies')
    .select('ghl_agency_token, ghl_company_id')
    .eq('id', agencyId)
    .maybeSingle()
  return {
    token: data?.ghl_agency_token ?? process.env.GHL_AGENCY_TOKEN ?? null,
    companyId: data?.ghl_company_id ?? process.env.GHL_COMPANY_ID ?? null,
  }
})
