import { getInitialClienti } from '@/lib/bellessere/pageData'
import ClientiView from './ClientiView'

export const dynamic = 'force-dynamic'

export default async function ClientiPage() {
  const initial = await getInitialClienti().catch(() => undefined)
  return <ClientiView initial={initial} />
}
