import { redirect, notFound } from 'next/navigation'

export default async function DesignDemoDashboardAliasPage({
  params,
}: {
  params: Promise<{ design: string }>
}) {
  const { design } = await params

  if (design !== 'simfonia') {
    notFound()
  }

  redirect(`/designs/${design}/demo`)
}
