import { getBellessereSession } from '@/lib/bellessere/auth'
import Sidebar from './_components/Sidebar'
import './shell.css'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Bellessere' }

export default async function BellessereLayout({ children }: { children: React.ReactNode }) {
  const session = await getBellessereSession()
  return (
    <div className="bs-shell" style={{ display: 'flex' }}>
      <Sidebar email={session.email} />
      <main className="bs-main">{children}</main>
    </div>
  )
}
