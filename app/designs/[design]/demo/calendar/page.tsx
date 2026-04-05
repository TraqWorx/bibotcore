import { notFound } from 'next/navigation'
import { DemoCalendarView } from '../_components/DemoViews'

export default async function DesignDemoCalendarPage({
  params,
}: {
  params: Promise<{ design: string }>
}) {
  const { design } = await params
  if (design !== 'simfonia') notFound()
  return <DemoCalendarView />
}
