import { getActiveLocation } from '@/lib/location/getActiveLocation'
import ContactsClient from './_components/ContactsClient'

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const locationId = await getActiveLocation(sp)

  return <ContactsClient locationId={locationId} />
}
