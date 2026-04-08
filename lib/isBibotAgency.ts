/** The Bibot agency gets full free access — bypasses all paywalls */
export const BIBOT_AGENCY_ID = 'e7b3d0d8-5682-44d5-87c1-c449e6814f15'

export function isBibotAgency(agencyId: string | null | undefined): boolean {
  return agencyId === BIBOT_AGENCY_ID
}
