import type { createAdminClient } from '@/lib/supabase-server'

export const PROOFS_BUCKET = 'apulia-payment-proofs'

/**
 * proof_url historically stored the full public URL; it now stores the bare
 * object path (the bucket is private). Accept both formats.
 */
export function proofObjectPath(stored: string): string {
  const marker = `/${PROOFS_BUCKET}/`
  const i = stored.indexOf(marker)
  return (i >= 0 ? stored.slice(i + marker.length) : stored).split('?')[0]
}

/** Signed, time-limited download URL for a stored proof reference (1 hour). */
export async function signProofUrl(
  sb: ReturnType<typeof createAdminClient>,
  stored: string | null,
): Promise<string | null> {
  if (!stored) return null
  const { data } = await sb.storage
    .from(PROOFS_BUCKET)
    .createSignedUrl(proofObjectPath(stored), 3600)
  return data?.signedUrl ?? null
}
