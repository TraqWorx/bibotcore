import { notFound } from 'next/navigation'
import { ApuliaDemoCampaignsView } from '../_components/ApuliaDemoViews'

export default async function DesignDemoCampaignsPage({
  params,
}: {
  params: Promise<{ design: string }>
}) {
  const { design } = await params
  if (design === 'apulia-tourism') return <ApuliaDemoCampaignsView />
  notFound()
}
