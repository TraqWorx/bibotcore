import { getInitialAppuntamenti } from '@/lib/bellessere/pageData'
import AppuntamentiView from './AppuntamentiView'

export const dynamic = 'force-dynamic'

export default async function AppuntamentiPage() {
  const initial = await getInitialAppuntamenti().catch(() => undefined)
  return <AppuntamentiView initial={initial} />
}
