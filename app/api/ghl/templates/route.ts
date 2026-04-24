import { NextRequest, NextResponse } from 'next/server'
import { getGhlClient } from '@/lib/ghl/ghlClient'

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('locationId')
  const type = req.nextUrl.searchParams.get('type') ?? 'sms'
  if (!locationId) return NextResponse.json({ templates: [] })

  try {
    const ghl = await getGhlClient(locationId)
    const data = await ghl.templates.list()
    const raw = (data?.templates ?? []) as {
      id: string; name: string; type?: string; status?: string
      body?: string; templateBody?: string
      template?: { body?: string; attachments?: string[] }
      urlAttachments?: string[]
    }[]

    // Normalize: body can be at root or nested in template.body
    const normalized = raw.map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type ?? '',
      status: t.status ?? '',
      body: t.template?.body ?? t.body ?? t.templateBody ?? '',
      attachments: t.template?.attachments ?? t.urlAttachments ?? [],
    }))

    // Filter by type
    let filtered = normalized
    if (type === 'whatsapp') {
      filtered = normalized.filter((t) => t.type.toLowerCase().includes('whatsapp'))
    } else if (type === 'sms') {
      filtered = normalized.filter((t) => !t.type.toLowerCase().includes('whatsapp'))
    }

    return NextResponse.json({ templates: filtered })
  } catch (err) {
    console.error('[api/ghl/templates]', err instanceof Error ? err.message : err)
    return NextResponse.json({ templates: [] })
  }
}
