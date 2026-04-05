import { notFound } from 'next/navigation'
import { DemoSettingsView } from '../_components/DemoViews'

export default async function DesignDemoSettingsPage({
  params,
}: {
  params: Promise<{ design: string }>
}) {
  const { design } = await params
  if (design !== 'simfonia') notFound()
  return <DemoSettingsView />
}
