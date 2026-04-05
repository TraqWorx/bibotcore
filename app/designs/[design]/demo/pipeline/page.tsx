import { notFound } from 'next/navigation'
import { DemoPipelineView } from '../_components/DemoViews'

export default async function DesignDemoPipelinePage({
  params,
}: {
  params: Promise<{ design: string }>
}) {
  const { design } = await params
  if (design !== 'simfonia') notFound()
  return <DemoPipelineView />
}
