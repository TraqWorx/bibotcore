/**
 * Fire-and-forget self-trigger for the PDP /continue endpoint. Uses
 * NEXT_PUBLIC_APP_URL as the base and the CRON_SECRET as the auth.
 * The actual fetch is awaited briefly (Promise.race with a tiny
 * timeout) so it leaves the box before the parent function exits, but
 * we never block on the response.
 */
export async function triggerPdpContinue(importId: string): Promise<void> {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'https://core.bibotcrm.it'
  const secret = process.env.CRON_SECRET ?? ''
  const url = `${base}/api/apulia/import/pdp/continue?id=${encodeURIComponent(importId)}`
  try {
    const p = fetch(url, {
      method: 'POST',
      headers: { 'X-Internal-Secret': secret },
      // Don't keep the connection alive — we don't want the response.
    }).catch(() => undefined)
    // Wait up to 100ms so the request actually leaves; then return.
    await Promise.race([p, new Promise((r) => setTimeout(r, 100))])
  } catch {
    // ignore — pg_cron safety net will catch a missed trigger eventually
  }
}
