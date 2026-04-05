import { notFound } from 'next/navigation'
import { DemoConversationsView } from '../_components/DemoViews'

export default async function DesignDemoConversationsPage({
  params,
}: {
  params: Promise<{ design: string }>
}) {
  const { design } = await params
  if (design !== 'simfonia') notFound()
  return <DemoConversationsView />
}
