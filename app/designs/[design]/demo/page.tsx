import DashboardClient from '@/app/designs/simfonia/dashboard/_components/DashboardClient'
import { notFound } from 'next/navigation'
import { demoDashboardData } from './_lib/demoData'

export default async function DesignDemoDashboardPage({
  params,
}: {
  params: Promise<{ design: string }>
}) {
  const { design } = await params

  if (design !== 'simfonia') {
    notFound()
  }

  return <DashboardClient locationId="demo-simfonia" demoData={demoDashboardData} demoMode />
}
