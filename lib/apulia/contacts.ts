import { ghlFetch, pmap } from './ghl'
import { APULIA_LOCATION_ID, APULIA_FIELD, getField, type CustomFieldEntry } from './fields'

export interface ApuliaContact {
  id: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  tags?: string[]
  customFields?: CustomFieldEntry[]
}

/** Page through every contact on Apulia. ~3.7k contacts → ~10s. */
export async function fetchAllContacts(): Promise<ApuliaContact[]> {
  const out: ApuliaContact[] = []
  let searchAfter: unknown[] | null = null
  while (true) {
    const body: Record<string, unknown> = { locationId: APULIA_LOCATION_ID, pageLimit: 500 }
    if (searchAfter) body.searchAfter = searchAfter
    const r = await ghlFetch('/contacts/search', { method: 'POST', body: JSON.stringify(body) })
    if (!r.ok) throw new Error(`contacts/search failed: ${r.status} ${await r.text()}`)
    const j = (await r.json()) as { contacts?: ApuliaContact[]; total?: number }
    const batch = j.contacts ?? []
    out.push(...batch)
    if (batch.length < 500) break
    const last = batch[batch.length - 1] as ApuliaContact & { sortBy?: unknown[]; searchAfter?: unknown[] }
    searchAfter = last.searchAfter ?? last.sortBy ?? null
    if (!searchAfter) break // can't paginate further with this endpoint shape — we got everything we can
    if (out.length > 50000) break // hard safety cap
  }
  return out
}

/** Build a lookup: POD/PDR (uppercased) → contact. */
export function indexByPodPdr(contacts: ApuliaContact[]): Map<string, ApuliaContact> {
  const m = new Map<string, ApuliaContact>()
  for (const c of contacts) {
    const pod = getField(c.customFields, APULIA_FIELD.POD_PDR)?.toUpperCase().trim()
    if (pod) m.set(pod, c)
  }
  return m
}

/** Build a lookup: Codice amministratore → contact. (Used for admin contacts.) */
export function indexByCodiceAmministratore(contacts: ApuliaContact[]): Map<string, ApuliaContact> {
  const m = new Map<string, ApuliaContact>()
  for (const c of contacts) {
    const code = getField(c.customFields, APULIA_FIELD.CODICE_AMMINISTRATORE)?.trim()
    if (code) m.set(String(code), c)
  }
  return m
}

export interface UpsertContactInput {
  /** Contact id when updating; omit when creating. */
  id?: string
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
  tags?: string[]
  removeTags?: string[]
  customField?: Record<string, string | number>
}

/** Create or update a contact. Returns the resulting contact id. */
export async function upsertContact(input: UpsertContactInput): Promise<string> {
  // GHL contact endpoints expect customFields as an array of { id, value }
  // for both POST and PUT. The "customField: { id: value }" object form is
  // ONLY accepted by POST; PUT silently rejects it with 422 — caused every
  // update to drop its custom fields without surfacing an error.
  const customFieldsArray = input.customField
    ? Object.entries(input.customField).map(([id, value]) => ({ id, value }))
    : undefined
  if (input.id) {
    const body: Record<string, unknown> = {}
    if (input.email != null) body.email = input.email
    if (input.phone != null) body.phone = input.phone
    if (input.firstName != null) body.firstName = input.firstName
    if (input.lastName != null) body.lastName = input.lastName
    if (input.tags) body.tags = input.tags
    if (customFieldsArray) body.customFields = customFieldsArray
    const r = await ghlFetch(`/contacts/${input.id}`, { method: 'PUT', body: JSON.stringify(body) })
    if (!r.ok) throw new Error(`PUT /contacts/${input.id} -> ${r.status} ${await r.text()}`)
    return input.id
  }
  const body: Record<string, unknown> = { locationId: APULIA_LOCATION_ID }
  if (input.email) body.email = input.email
  if (input.phone) body.phone = input.phone
  if (input.firstName) body.firstName = input.firstName
  if (input.lastName) body.lastName = input.lastName
  if (input.tags) body.tags = input.tags
  if (customFieldsArray) body.customFields = customFieldsArray
  const r = await ghlFetch('/contacts/', { method: 'POST', body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`POST /contacts -> ${r.status} ${await r.text()}`)
  const j = (await r.json()) as { contact?: { id: string }; id?: string }
  return j.contact?.id ?? j.id ?? ''
}

/** Add a tag to a contact (idempotent). */
export async function addTag(contactId: string, tag: string): Promise<void> {
  await ghlFetch(`/contacts/${contactId}/tags`, { method: 'POST', body: JSON.stringify({ tags: [tag] }) })
}

/** Remove a tag from a contact (idempotent). */
export async function removeTag(contactId: string, tag: string): Promise<void> {
  await ghlFetch(`/contacts/${contactId}/tags`, { method: 'DELETE', body: JSON.stringify({ tags: [tag] }) })
}

/** Delete a contact from Bibot. */
export async function deleteContact(contactId: string): Promise<void> {
  const r = await ghlFetch(`/contacts/${contactId}`, { method: 'DELETE' })
  if (!r.ok && r.status !== 404) throw new Error(`DELETE /contacts/${contactId} -> ${r.status} ${await r.text()}`)
}

export { pmap }
