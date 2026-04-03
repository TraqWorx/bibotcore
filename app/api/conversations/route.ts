import { NextRequest, NextResponse } from 'next/server'
import { getLocationAccess } from '@/lib/auth/assertLocationAccess'
import { getConversations, getLocationUsers } from '@/app/designs/simfonia/conversations/_actions'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('locationId')
  if (!locationId) return NextResponse.json({ error: 'locationId required' }, { status: 400 })

  const access = await getLocationAccess(req, locationId)
  if (access.status === 'unauthenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (access.status === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [conversations, users] = await Promise.all([
    getConversations(locationId),
    getLocationUsers(locationId),
  ])

  return NextResponse.json({
    conversations,
    users,
    currentUserEmail: access.email,
  })
}
