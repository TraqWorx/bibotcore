import { notFound } from 'next/navigation'
import { DemoSettingsView } from '../_components/DemoViews'
import { ApuliaDemoSettingsView } from '../_components/ApuliaDemoViews'

export default async function DesignDemoSettingsPage({
  params,
}: {
  params: Promise<{ design: string }>
}) {
  const { design } = await params
  if (design === 'apulia-tourism') return <ApuliaDemoSettingsView />
  if (design === 'simfonia') return <DemoSettingsView />
  notFound()
}
