import SimfoniaDashboard from '@/app/designs/simfonia/dashboard/_components/DashboardClient'
import ApuliaDashboard from '@/app/designs/apulia-tourism/dashboard/_components/DashboardClient'
import { notFound } from 'next/navigation'
import { demoDashboardData } from './_lib/demoData'

export default async function DesignDemoDashboardPage({
  params,
}: {
  params: Promise<{ design: string }>
}) {
  const { design } = await params

  if (design === 'apulia-tourism') {
    return <ApuliaDashboard locationId="demo-apulia-tourism" demoMode />
  }

  if (design === 'simfonia') {
    return <SimfoniaDashboard locationId="demo-simfonia" demoData={demoDashboardData} demoMode />
  }

  notFound()
}
