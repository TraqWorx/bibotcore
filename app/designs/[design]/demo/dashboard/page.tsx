import { redirect, notFound } from 'next/navigation'

const SUPPORTED = ['simfonia', 'apulia-tourism']

export default async function DesignDemoDashboardAliasPage({
  params,
}: {
  params: Promise<{ design: string }>
}) {
  const { design } = await params

  if (!SUPPORTED.includes(design)) {
    notFound()
  }

  redirect(`/designs/${design}/demo`)
}
