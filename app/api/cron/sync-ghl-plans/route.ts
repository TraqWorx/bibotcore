import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { fetchGhlPlans } from '@/lib/ghl/getGhlPlans'

export const dynamic = 'force-dynamic'

function authorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') return true
  const secret = req.headers.get('authorization')?.replace('Bearer ', '') ?? req.nextUrl.searchParams.get('secret')
  return Boolean(process.env.CRON_SECRET) && secret === process.env.CRON_SECRET
}

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
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
