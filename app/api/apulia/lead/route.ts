import { NextRequest, NextResponse } from 'next/server'
import { ghlFetch } from '@/lib/apulia/ghl'
import { APULIA_LOCATION_ID } from '@/lib/apulia/fields'
import { getStoreBySlug } from '@/lib/apulia/stores'
import { upsertCachedFromGhl } from '@/lib/apulia/cache'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface LeadInput {
  storeSlug: string
  firstName: string
  lastName?: string
  email: string
  phone?: string
  address?: string
  city?: string
  notes?: string
  honeypot?: string
}

function sanitizePhone(raw?: string): string | undefined {
  if (!raw) return undefined
  const digits = String(raw).replace(/[^\d+]/g, '')
  if (!digits || /^0+$/.test(digits)) return undefined
  if (digits.startsWith('+')) return digits
  if (digits.startsWith('00')) return '+' + digits.slice(2)
  if (digits.startsWith('39')) return '+' + digits
  return '+39' + digits
}

export async function POST(req: NextRequest) {
  let body: LeadInput
  try {
    body = (await req.json()) as LeadInput
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Honeypot — silently accept and drop bot submissions.
  if (body.honeypot && body.honeypot.length > 0) {
    return NextResponse.json({ ok: true, dropped: true })
  }

  const slug = String(body.storeSlug || '').trim()
  if (!slug) return NextResponse.json({ error: 'storeSlug required' }, { status: 400 })

  const firstName = String(body.firstName || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  if (!firstName) return NextResponse.json({ error: 'Nome richiesto' }, { status: 400 })
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Email non valida' }, { status: 400 })
  }

  const store = await getStoreBySlug(slug)
  if (!store || !store.active) return NextResponse.json({ error: 'Store non trovato' }, { status: 404 })

  const tags = ['lead', `store-${store.slug}`]
  const phone = sanitizePhone(body.phone)
  const lastName = body.lastName?.trim() || undefined

  const payload: Record<string, unknown> = {
    locationId: APULIA_LOCATION_ID,
    firstName,
    email,
    tags,
    source: `Form QR — ${store.name}`,
  }
  if (lastName) payload.lastName = lastName
  if (phone) payload.phone = phone
  if (body.address) payload.address1 = body.address
  if (body.city) payload.city = body.city

  const r = await ghlFetch('/contacts/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (!r.ok) {
    const text = await r.text()
    if (r.status === 400 && /duplicat/i.test(text)) {
      return NextResponse.json({ ok: true, duplicate: true })
    }
    return NextResponse.json({ error: 'create failed', detail: text.slice(0, 200) }, { status: 502 })
  }

  const j = (await r.json()) as { contact?: { id: string; firstName?: string; lastName?: string; email?: string; phone?: string; tags?: string[]; customFields?: { id: string; value?: string }[] } }
  const contact = j.contact
  if (contact?.id) {
    // Mirror to local cache so the dashboard counts update immediately.
    try {
      await upsertCachedFromGhl({
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        tags: contact.tags ?? tags,
        customFields: contact.customFields ?? [],
      })
    } catch (err) {
      console.error('[lead] cache update:', err)
    }
  }

  return NextResponse.json({ ok: true, id: contact?.id, store: store.slug })
}
