import { NextRequest, NextResponse } from 'next/server'
import { getGhlTokenForLocation } from '@/lib/ghl/getGhlTokenForLocation'
import { getLocationAccess } from '@/lib/auth/assertLocationAccess'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const locationId = formData.get('locationId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }
    if (!locationId) {
      return NextResponse.json({ error: 'Missing locationId' }, { status: 400 })
    }

    const access = await getLocationAccess(req, locationId)
    if (access.status === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (access.status === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const token = await getGhlTokenForLocation(locationId)

    const ghlForm = new FormData()
    ghlForm.append('file', file, file.name)
    ghlForm.append('locationId', locationId)

    const res = await fetch('https://services.leadconnectorhq.com/medias/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Version: '2021-07-28',
      },
      body: ghlForm,
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { error: `GHL upload failed: ${res.status} ${text}` },
        { status: res.status }
      )
    }

    const data = await res.json()
    return NextResponse.json({ url: data.url ?? data.fileUrl ?? '' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
