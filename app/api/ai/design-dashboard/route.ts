import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getLocationAccess } from '@/lib/auth/assertLocationAccess'
import type Anthropic from '@anthropic-ai/sdk'
import { buildDesignerPrompt } from '@/lib/widgets/ai-prompt'
import { validateConfig } from '@/lib/widgets/validateConfig'

async function getAnthropic() {
  const { default: Client } = await import('@anthropic-ai/sdk')
  return new Client()
}

export async function POST(req: NextRequest) {
  const { prompt, locationId } = await req.json()
  if (!prompt || !locationId) {
    return NextResponse.json({ error: 'prompt and locationId required' }, { status: 400 })
  }

  const access = await getLocationAccess(req, locationId)
  if (access.status === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.status === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id').eq('id', access.userId).single()

  // Verify subscription
  const { isBibotAgency } = await import('@/lib/isBibotAgency')
  const platformBypass = access.isSuperAdmin || isBibotAgency(profile?.agency_id)
  const agencyId = profile?.agency_id
  if (!platformBypass && !agencyId) return NextResponse.json({ error: 'No agency' }, { status: 403 })
  if (!platformBypass) {
    const { data: subscription } = await sb
      .from('agency_subscriptions')
      .select('status')
      .eq('agency_id', agencyId)
      .eq('location_id', locationId)
      .eq('status', 'active')
      .maybeSingle()
    if (!subscription) {
      return NextResponse.json({ error: 'Active subscription required' }, { status: 403 })
    }
  }

  try {
    const systemPrompt = buildDesignerPrompt()

    const anthropic = await getAnthropic()
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'AI did not return valid JSON' }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0])
    const layout = validateConfig(parsed)

    if (!layout) {
      return NextResponse.json({ error: 'AI generated invalid widget config' }, { status: 500 })
    }

    return NextResponse.json({ layout })
  } catch (err) {
    console.error('[AI Designer]', err)
    return NextResponse.json({ error: 'AI generation failed' }, { status: 500 })
  }
}
