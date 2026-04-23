import { notFound } from 'next/navigation'
import { DemoConversationsView } from '../_components/DemoViews'
import { ApuliaDemoConversationsView } from '../_components/ApuliaDemoViews'

export default async function DesignDemoConversationsPage({
  params,
}: {
  params: Promise<{ design: string }>
}) {
  const { design } = await params
  if (design === 'apulia-tourism') return <ApuliaDemoConversationsView />
  if (design === 'simfonia') return <DemoConversationsView />
  notFound()
}
