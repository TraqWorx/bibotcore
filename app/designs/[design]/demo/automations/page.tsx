import { notFound } from 'next/navigation'
import { DemoAutomationsView } from '../_components/DemoViews'

export default async function DesignDemoAutomationsPage({
  params,
}: {
  params: Promise<{ design: string }>
}) {
  const { design } = await params
  if (design !== 'simfonia') notFound()
  return <DemoAutomationsView />
}
