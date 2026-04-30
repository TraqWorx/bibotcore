import { getApuliaSession } from '@/lib/apulia/auth'
import Sidebar from './_components/Sidebar'
import './shell.css'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Apulia Power · Commissioni' }

export default async function ApuliaPowerLayout({ children }: { children: React.ReactNode }) {
  const session = await getApuliaSession()
  return (
    <div className="ap-shell" style={{ display: 'flex' }}>
      <Sidebar role={session.role} email={session.email} />
      <main className="ap-main">{children}</main>
    </div>
  )
}
