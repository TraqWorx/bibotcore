import { POST as handleGhlWebhook } from '../route'

export const dynamic = 'force-dynamic'

/**
 * Same handler, with the secret in the path: GHL's app settings reject a
 * webhook URL with a query string, and it cannot send custom headers.
 */
export async function POST(req: Request, ctx: { params: Promise<{ secret: string }> }) {
  const { secret } = await ctx.params
  const headers = new Headers(req.headers)
  headers.set('x-webhook-secret', secret)
  return handleGhlWebhook(new Request(req.url, { method: 'POST', headers, body: await req.text() }))
}
