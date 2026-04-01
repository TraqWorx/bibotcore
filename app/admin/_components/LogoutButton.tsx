'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-xl border border-gray-200/80 bg-white/80 px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm backdrop-blur-sm transition hover:bg-white"
    >
      Logout
    </button>
  )
}
