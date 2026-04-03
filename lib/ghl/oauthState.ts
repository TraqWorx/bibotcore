import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

const STATE_TTL_MS = 10 * 60 * 1000

export type OAuthStatePayload =
  | { flow: 'package_install'; packageSlug: string; nonce: string; iat: number; exp: number }
  | { flow: 'admin_design_install'; designSlug: string; nonce: string; iat: number; exp: number }

function getOAuthStateSecret() {
  const secret = process.env.GHL_OAUTH_STATE_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) {
    throw new Error('Missing OAuth state secret')
  }
  return secret
}

function toBase64Url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function fromBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function sign(payload: string) {
  return createHmac('sha256', getOAuthStateSecret()).update(payload).digest('base64url')
}

function constantTimeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  return aBuf.length === bBuf.length && timingSafeEqual(aBuf, bBuf)
}

export function createOAuthState(
  input: { flow: 'package_install'; packageSlug: string } | { flow: 'admin_design_install'; designSlug: string },
) {
  const now = Date.now()
  const payload: OAuthStatePayload = input.flow === 'package_install'
    ? {
        flow: input.flow,
        packageSlug: input.packageSlug,
        nonce: randomUUID(),
        iat: now,
        exp: now + STATE_TTL_MS,
      }
    : {
        flow: input.flow,
        designSlug: input.designSlug,
        nonce: randomUUID(),
        iat: now,
        exp: now + STATE_TTL_MS,
      }

  const encodedPayload = toBase64Url(JSON.stringify(payload))
  const signature = sign(encodedPayload)
  return `${encodedPayload}.${signature}`
}

export function verifyOAuthState(state: string): OAuthStatePayload | null {
  const [encodedPayload, providedSignature] = state.split('.')
  if (!encodedPayload || !providedSignature) return null

  const expectedSignature = sign(encodedPayload)
  if (!constantTimeEqual(expectedSignature, providedSignature)) return null

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as Partial<OAuthStatePayload>
    if (!payload || typeof payload !== 'object') return null
    if (typeof payload.nonce !== 'string' || typeof payload.iat !== 'number' || typeof payload.exp !== 'number') return null
    if (payload.exp < Date.now()) return null
    if (payload.flow === 'package_install' && typeof payload.packageSlug === 'string') {
      return payload as OAuthStatePayload
    }
    if (payload.flow === 'admin_design_install' && typeof payload.designSlug === 'string') {
      return payload as OAuthStatePayload
    }
    return null
  } catch {
    return null
  }
}
