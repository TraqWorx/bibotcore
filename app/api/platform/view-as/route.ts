import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { VIEW_AS_AGENCY_COOKIE } from '@/lib/admin/viewAsAgency'

export const dynamic = 'force-dynamic'

/** Super admin only: open an agency's admin panel as they see it, or stop. */
export async function GET(req: NextRequest) {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  const { data: profile } = await createAdminClient().from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return NextResponse.redirect(new URL('/admin', req.url))

  const agencyId = req.nextUrl.searchParams.get('agencyId')
  const res = NextResponse.redirect(new URL(agencyId ? '/admin' : '/platform/agencies', req.url))
  if (agencyId) res.cookies.set(VIEW_AS_AGENCY_COOKIE, agencyId, { httpOnly: true, sameSite: 'lax', path: '/' })
  else res.cookies.delete(VIEW_AS_AGENCY_COOKIE)
  return res
}
