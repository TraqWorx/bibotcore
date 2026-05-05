import { ghlFetch } from './ghl'
import { APULIA_LOCATION_ID, APULIA_FIELD } from './fields'

export interface RawField {
  id: string
  name: string
  dataType?: string
  picklistOptions?: { value: string; label?: string }[]
}

export interface GroupedField {
  id: string
  label: string
  dataType: string
  picklistOptions?: { value: string; label?: string }[]
}

export interface FieldGroup {
  title: string
  fields: GroupedField[]
}

const PREFIX_TO_GROUP: { prefix: string; group: string; stripPrefix: boolean }[] = [
  // More specific prefix wins (admin sub-block before generic Cliente).
  { prefix: 'Fornitura : Cliente : Amministratore condominio : ', group: 'Amministratore condominio', stripPrefix: true },
  { prefix: 'Fornitura : Dati di fatturazione : ', group: 'Fatturazione', stripPrefix: true },
  { prefix: 'Fornitura : Modalita di pagamento : ', group: 'Pagamento', stripPrefix: true },
  { prefix: 'Fornitura : Modalità di pagamento : ', group: 'Pagamento', stripPrefix: true },
  { prefix: 'Fornitura : Opportunità : ', group: 'Opportunità', stripPrefix: true },
  { prefix: 'Fornitura : Consorzio : ', group: 'Consorzio', stripPrefix: true },
  { prefix: 'Fornitura : Cliente : ', group: 'Cliente', stripPrefix: true },
  { prefix: 'Fornitura : ', group: 'Fornitura', stripPrefix: true },
]

const HIDDEN_FIELD_IDS = new Set<string>([
  // Don't expose computed fields directly — they're recomputed by the system.
  APULIA_FIELD.COMMISSIONE_TOTALE,
])

/** Fetch all custom fields for the Apulia location, grouped for editor display. */
export async function fetchApuliaFieldGroups(): Promise<FieldGroup[]> {
  const r = await ghlFetch(`/locations/${APULIA_LOCATION_ID}/customFields`)
  if (!r.ok) return []
  const json = (await r.json()) as { customFields?: RawField[] }
  const fields = (json.customFields ?? []).filter((f) => !HIDDEN_FIELD_IDS.has(f.id))

  const groups = new Map<string, GroupedField[]>()
  function push(group: string, f: GroupedField) {
    const arr = groups.get(group) ?? []
    arr.push(f)
    groups.set(group, arr)
  }

  for (const f of fields) {
    let group = 'Altri'
    let label = f.name
    for (const m of PREFIX_TO_GROUP) {
      if (f.name.startsWith(m.prefix)) {
        group = m.group
        label = m.stripPrefix ? f.name.slice(m.prefix.length) : f.name
        break
      }
    }
    push(group, {
      id: f.id,
      label,
      dataType: (f.dataType ?? 'TEXT').toUpperCase(),
      picklistOptions: f.picklistOptions,
    })
  }

  // Sort groups in a stable order; "Altri" last.
  const order = ['Cliente', 'Fornitura', 'Fatturazione', 'Pagamento', 'Opportunità', 'Consorzio', 'Amministratore condominio', 'Altri']
  const result: FieldGroup[] = []
  for (const g of order) {
    const list = groups.get(g)
    if (list && list.length) {
      list.sort((a, b) => a.label.localeCompare(b.label))
      result.push({ title: g, fields: list })
    }
  }
  // Append any unknown groups (defensive).
  for (const [g, list] of groups) {
    if (order.includes(g)) continue
    list.sort((a, b) => a.label.localeCompare(b.label))
    result.push({ title: g, fields: list })
  }
  return result
}

/** Map dataType to <input type=...>. Defaults to text. */
export function inputTypeFor(dataType: string): { type: string; inputMode?: 'numeric' | 'decimal' | 'tel' | 'email' | 'text' } {
  switch (dataType.toUpperCase()) {
    case 'NUMERICAL':
    case 'NUMBER':
      return { type: 'text', inputMode: 'decimal' }
    case 'EMAIL':
      return { type: 'email' }
    case 'PHONE':
      return { type: 'tel', inputMode: 'tel' }
    case 'DATE':
      return { type: 'date' }
    case 'CHECKBOX':
    case 'TEXTAREA':
    case 'TEXT':
    default:
      return { type: 'text' }
  }
}
