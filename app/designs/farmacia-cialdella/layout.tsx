import { getFarmaciaSession } from '@/lib/farmacia/auth'
import Sidebar from './_components/Sidebar'
import './shell.css'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Farmacia Cialdella' }

export default async function FarmaciaLayout({ children }: { children: React.ReactNode }) {
  const session = await getFarmaciaSession()
  return (
    <div className="fc-shell" style={{ display: 'flex' }}>
      <Sidebar email={session.email} />
      <main className="fc-main">{children}</main>
    </div>
  )
}
