import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getConversations, getLocationUsers } from '@/app/designs/simfonia/conversations/_actions'

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

  const [conversations, users] = await Promise.all([
    getConversations(locationId),
    getLocationUsers(locationId),
  ])

  return NextResponse.json({
    conversations,
    users,
    currentUserEmail: user.email ?? '',
  })
}
