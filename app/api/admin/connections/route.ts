import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'


async function getAuthenticatedAdmin() {
  const cookieStore = await cookies()
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )

  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return null

  const sb = createAdminClient()
  const { data: profile } = await sb
    .from('profiles')
    .select('role, agency_id')
    .eq('id', user.id)
    .single()

  // Global connections list — super_admin or Bibot only (not every agency admin).
  if (profile?.role === 'super_admin') return user
  const { isBibotAgency } = await import('@/lib/isBibotAgency')
  if (isBibotAgency(profile?.agency_id)) return user
  return null
}

export async function GET() {
  const supabase = createAdminClient()
  const user = await getAuthenticatedAdmin()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('ghl_connections')
    .select('location_id, company_id, package_slug, status, expires_at, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
