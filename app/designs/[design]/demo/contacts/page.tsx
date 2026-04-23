import { notFound } from 'next/navigation'
import { DemoContactsView } from '../_components/DemoViews'
import { ApuliaDemoContactsView } from '../_components/ApuliaDemoViews'

export default async function DesignDemoContactsPage({
  params,
}: {
  params: Promise<{ design: string }>
}) {
  const { design } = await params
  if (design === 'apulia-tourism') return <ApuliaDemoContactsView />
  if (design === 'simfonia') return <DemoContactsView />
  notFound()
}
