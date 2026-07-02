import { getInitialCalendario } from '@/lib/bellessere/pageData'
import CalendarioView from './CalendarioView'

export const dynamic = 'force-dynamic'

export default async function CalendarioPage() {
  const initial = await getInitialCalendario().catch(() => undefined)
  return <CalendarioView initial={initial} />
}
