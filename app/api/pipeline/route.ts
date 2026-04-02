import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return req.cookies.getAll() }, setAll() {} } },
  )
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const locationId = req.nextUrl.searchParams.get('locationId')
  if (!locationId) return NextResponse.json({ error: 'locationId required' }, { status: 400 })

  const sb = createAdminClient()
  const [{ data: pipelines }, { data: opportunities }, { data: contacts }, { data: users }] = await Promise.all([
    sb.from('cached_pipelines').select('ghl_id, name, stages').eq('location_id', locationId),
    sb.from('cached_opportunities').select('ghl_id, name, pipeline_id, pipeline_stage_id, contact_ghl_id, monetary_value, status, assigned_to, synced_at').eq('location_id', locationId),
    sb.from('cached_contacts').select('ghl_id, first_name, last_name, email, phone, company_name, tags').eq('location_id', locationId),
    sb.from('cached_ghl_users').select('ghl_id, name').eq('location_id', locationId),
  ])

  // Build contact lookup
  const contactMap = new Map((contacts ?? []).map((c) => [c.ghl_id, c]))
  const userMap = new Map((users ?? []).map((u) => [u.ghl_id, u.name]))

  return NextResponse.json({
    pipelines: (pipelines ?? []).map((p) => ({
      id: p.ghl_id, name: p.name ?? '', stages: p.stages ?? [],
    })),
    opportunities: (opportunities ?? []).map((o) => {
      const contact = o.contact_ghl_id ? contactMap.get(o.contact_ghl_id) : null
      const assignedName = o.assigned_to ? userMap.get(o.assigned_to) : null
      return {
        id: o.ghl_id,
        name: o.name,
        pipelineId: o.pipeline_id,
        pipelineStageId: o.pipeline_stage_id,
        contactId: o.contact_ghl_id,
        monetaryValue: o.monetary_value != null ? Number(o.monetary_value) : undefined,
        status: o.status,
        assignedTo: assignedName ?? null,
        lastUpdated: o.synced_at,
        contact: contact ? {
          name: [contact.first_name, contact.last_name].filter(Boolean).join(' ') || null,
          firstName: contact.first_name,
          lastName: contact.last_name,
          email: contact.email,
          phone: contact.phone,
          company: contact.company_name,
          tags: contact.tags ?? [],
        } : null,
      }
    }),
  })
}
