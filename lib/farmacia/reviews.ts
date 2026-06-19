/**
 * GHL reputation reviews → farmacia_reviews cache. Mirrors the invoices
 * fetch+cache pattern. The reputation endpoint/shape can vary by GHL version,
 * so the mapper reads fields defensively; adjust REVIEWS_PATH / field names if
 * the live API differs.
 */

import { createAdminClient } from '@/lib/supabase-server'
import { ghlFetch } from './ghl'
import { FARMACIA_LOCATION_ID } from './fields'

const REVIEWS_PATH = '/reputation/reviews'
const PAGE_LIMIT = 100
const MAX_PAGES = 50

interface RawReview {
  id?: string
  _id?: string
  reviewId?: string
  rating?: number
  title?: string
  heading?: string
  body?: string
  comment?: string
  content?: string
  reviewerName?: string
  reviewer?: { name?: string } | string
  name?: string
  platform?: string
  source?: string
  type?: string
  status?: string
  reply?: string
  response?: string
  createdAt?: string
  dateAdded?: string
  reviewDate?: string
}

function str(v: unknown): string | null {
  return v == null ? null : String(v)
}

/** Map a raw GHL review to a cache row. Exported for unit testing. */
export function mapReview(raw: RawReview, locationId: string): Record<string, unknown> | null {
  const id = raw.id ?? raw._id ?? raw.reviewId
  if (!id) return null
  const reviewer =
    typeof raw.reviewer === 'string' ? raw.reviewer : raw.reviewer?.name ?? raw.reviewerName ?? raw.name ?? null
  const date = raw.reviewDate ?? raw.createdAt ?? raw.dateAdded ?? null
  return {
    id: String(id),
    location_id: locationId,
    rating: typeof raw.rating === 'number' ? raw.rating : null,
    title: str(raw.title ?? raw.heading),
    body: str(raw.body ?? raw.comment ?? raw.content),
    reviewer_name: reviewer,
    platform: str(raw.platform ?? raw.source ?? raw.type),
    status: str(raw.status),
    reply: str(raw.reply ?? raw.response),
    review_date: date,
    raw,
    synced_at: new Date().toISOString(),
  }
}

export async function syncReviews(): Promise<{ count: number }> {
  const sb = createAdminClient()
  let offset = 0
  let total = 0
  for (let page = 0; page < MAX_PAGES; page++) {
    const r = await ghlFetch(`${REVIEWS_PATH}?locationId=${FARMACIA_LOCATION_ID}&limit=${PAGE_LIMIT}&offset=${offset}`)
    if (!r.ok) {
      if (page === 0) throw new Error(`Reputation API ${r.status}: ${(await r.text()).slice(0, 200)}`)
      break
    }
    const j = (await r.json()) as { reviews?: RawReview[]; data?: RawReview[] }
    const batch = j.reviews ?? j.data ?? []
    if (!batch.length) break
    const rows = batch.map((b) => mapReview(b, FARMACIA_LOCATION_ID)).filter((x): x is Record<string, unknown> => !!x)
    if (rows.length) {
      const { error } = await sb.from('farmacia_reviews').upsert(rows, { onConflict: 'id' })
      if (error) throw new Error(`reviews upsert: ${error.message}`)
      total += rows.length
    }
    if (batch.length < PAGE_LIMIT) break
    offset += PAGE_LIMIT
  }
  return { count: total }
}

export interface ReviewRow {
  id: string
  rating: number | null
  title: string | null
  body: string | null
  reviewer_name: string | null
  platform: string | null
  status: string | null
  reply: string | null
  review_date: string | null
}

export async function listReviewsCached(limit = 100): Promise<ReviewRow[]> {
  const sb = createAdminClient()
  const { data } = await sb
    .from('farmacia_reviews')
    .select('id, rating, title, body, reviewer_name, platform, status, reply, review_date')
    .order('review_date', { ascending: false, nullsFirst: false })
    .limit(limit)
  return (data ?? []) as ReviewRow[]
}
