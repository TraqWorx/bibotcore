import { NextRequest } from 'next/server'

/**
 * Auth gate for cron / secret-protected internal routes.
 *
 * Fails CLOSED: the request is authorized only when CRON_SECRET is configured
 * AND the caller presents a matching secret. There is NO environment-based
 * bypass — a missing or mismatched secret is always rejected, including on
 * preview/staging deployments (where an open endpoint would otherwise expose
 * token refresh, bulk sync, and message sending).
 *
 * Prefer the `Authorization: Bearer <secret>` header (what Vercel Cron sends).
 * The `?secret=` query param is accepted for external schedulers but ends up in
 * access logs, so use the header where possible.
 */
export function isCronAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const provided =
    req.headers.get('authorization')?.replace('Bearer ', '') ??
    req.nextUrl.searchParams.get('secret')
  return provided === expected
}
