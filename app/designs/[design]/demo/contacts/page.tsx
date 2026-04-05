import { notFound } from 'next/navigation'
import { DemoContactsView } from '../_components/DemoViews'

export default async function DesignDemoContactsPage({
  params,
}: {
  params: Promise<{ design: string }>
}) {
  const { design } = await params
  if (design !== 'simfonia') notFound()
  return <DemoContactsView />
}
