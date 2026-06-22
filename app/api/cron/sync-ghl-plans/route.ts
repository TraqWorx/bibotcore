import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { fetchGhlPlans } from '@/lib/ghl/getGhlPlans'
import { isCronAuthorized } from '@/lib/auth/cronAuth'

export const dynamic = 'force-dynamic'

async function run(): Promise<{ synced: number; plans: { id: string; name: string; priceMonthly: number | null }[] }> {
  const { plans } = await fetchGhlPlans()
  const sb = createAdminClient()

  let synced = 0
  for (const p of plans) {
    const { error } = await sb
      .from('ghl_plans')
      .upsert(
        { ghl_plan_id: p.id, name: p.name, price_monthly: p.priceMonthly },
        { onConflict: 'ghl_plan_id' },
      )
    if (error) {
      console.error(`[sync-ghl-plans] upsert ${p.id} failed:`, error.message)
      continue
    }
    synced++
  }

  return { synced, plans }
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const summary = await run()
    return NextResponse.json(summary)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
