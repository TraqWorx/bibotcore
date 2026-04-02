import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase-server'
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
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') return null
  return user
}

export async function GET() {
  const user = await getAuthenticatedAdmin()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [{ data: packages, error: packagesError }, { data: connections, error: connectionsError }] =
    await Promise.all([
      createAdminClient().from('packages').select('slug, name, auto_install'),
      createAdminClient().from('ghl_connections').select('package_slug, status, location_id'),
    ])

  if (packagesError) {
    return NextResponse.json({ error: packagesError.message }, { status: 500 })
  }

  if (connectionsError) {
    return NextResponse.json({ error: connectionsError.message }, { status: 500 })
  }

  const result = (packages ?? []).map((pkg) => {
    const connection = (connections ?? []).find((c) => c.package_slug === pkg.slug)

    return {
      slug: pkg.slug,
      name: pkg.name,
      auto_install: pkg.auto_install,
      installed: !!connection,
      status: connection?.status ?? null,
      location_id: connection?.location_id ?? null,
    }
  })

  return NextResponse.json(result)
}
