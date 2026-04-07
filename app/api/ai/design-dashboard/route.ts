import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import Anthropic from '@anthropic-ai/sdk'
import { buildDesignerPrompt } from '@/lib/widgets/ai-prompt'
import { validateConfig } from '@/lib/widgets/validateConfig'

const anthropic = new Anthropic()

export async function POST(req: NextRequest) {
  const { prompt, locationId } = await req.json()
  if (!prompt || !locationId) {
    return NextResponse.json({ error: 'prompt and locationId required' }, { status: 400 })
  }

  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id').eq('id', user.id).single()
  if (!profile?.agency_id) return NextResponse.json({ error: 'No agency' }, { status: 403 })

  // Verify Pro plan
  const { data: subscription } = await sb
    .from('agency_subscriptions')
    .select('plan')
    .eq('agency_id', profile.agency_id)
    .eq('location_id', locationId)
    .eq('status', 'active')
    .single()

  if (!subscription || subscription.plan !== 'pro') {
    return NextResponse.json({ error: 'Pro plan required for AI designer' }, { status: 403 })
  }

  try {
    const systemPrompt = buildDesignerPrompt()

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
