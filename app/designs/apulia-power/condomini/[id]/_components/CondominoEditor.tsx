'use client'

import { useState } from 'react'
import FieldRow from '../../../_components/FieldRow'
import TagEditor from '../../../_components/TagEditor'
import AdminPicker, { type AdminOption } from '../../../_components/AdminPicker'
import {
  updateCondominoField,
  updateCondominoCore,
  addCondominoTag,
  removeCondominoTag,
  setCondominoAdminByCode,
} from '../_actions'
import { APULIA_FIELD } from '@/lib/apulia/fields'

const ADMIN_LINK_FIELD_IDS = new Set<string>([
  APULIA_FIELD.CODICE_AMMINISTRATORE,
  APULIA_FIELD.AMMINISTRATORE_CONDOMINIO,
])

// Pinned at the top in their own section — never shown again inside the
// per-group accordions below.
const PINNED_FIELD_IDS = new Set<string>([
  APULIA_FIELD.POD_PDR,
  APULIA_FIELD.CLIENTE,
  APULIA_FIELD.STATO,
])

const HIDDEN_FROM_GROUPS = new Set<string>([
  ...ADMIN_LINK_FIELD_IDS,
  ...PINNED_FIELD_IDS,
])

export interface FieldDef {
  id: string
  label: string
  dataType: string
  picklistOptions?: { value: string; label?: string }[]
}

export interface GroupDef {
  title: string
  fields: FieldDef[]
}

interface Props {
  contactId: string
  core: { firstName: string; lastName: string; email: string; phone: string }
  customFields: Record<string, string>
  tags: string[]
  tagSuggestions?: string[]
  groups: GroupDef[]
  adminOptions: AdminOption[]
  currentAdminCode: string
  currentAdminName: string
}

export default function CondominoEditor({ contactId, core, customFields, tags, tagSuggestions, groups, adminOptions, currentAdminCode, currentAdminName }: Props) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    groups.forEach((g, i) => { init[g.title] = i < 2 })
    return init
  })

  function saveCore(_: string, fieldId: string, value: string) {
    return updateCondominoCore(contactId, fieldId as 'firstName' | 'lastName' | 'email' | 'phone', value)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section className="ap-card ap-card-pad">
        <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>Contatto</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <FieldRow contactId={contactId} fieldId="firstName" label="Nome" initial={core.firstName} save={saveCore} />
          <FieldRow contactId={contactId} fieldId="lastName" label="Cognome" initial={core.lastName} save={saveCore} />
          <FieldRow contactId={contactId} fieldId="email" label="Email" type="email" initial={core.email} save={saveCore} />
          <FieldRow contactId={contactId} fieldId="phone" label="Telefono" type="tel" initial={core.phone} save={saveCore} />
        </div>
      </section>

      <section className="ap-card ap-card-pad">
        <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>Identificazione</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <FieldRow
            contactId={contactId}
            fieldId={APULIA_FIELD.POD_PDR}
            label="POD/PDR"
            initial={customFields[APULIA_FIELD.POD_PDR] ?? ''}
            save={updateCondominoField}
          />
          <FieldRow
            contactId={contactId}
            fieldId={APULIA_FIELD.CLIENTE}
            label="Cliente"
            initial={customFields[APULIA_FIELD.CLIENTE] ?? ''}
            save={updateCondominoField}
          />
          <FieldRow
            contactId={contactId}
            fieldId={APULIA_FIELD.STATO}
            label="Stato"
            initial={customFields[APULIA_FIELD.STATO] ?? ''}
            save={updateCondominoField}
          />
        </div>
      </section>

      <section className="ap-card ap-card-pad">
        <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>Amministratore</h3>
        <AdminPicker
          options={adminOptions}
          initialCode={currentAdminCode}
          initialName={currentAdminName}
          onSelect={(code) => setCondominoAdminByCode(contactId, code)}
          label="Codice · Amministratore"
        />
        <p style={{ fontSize: 11, color: 'var(--ap-text-faint)', margin: '6px 0 0' }}>
          Cerca per codice o nome. Il codice e il nome vengono aggiornati insieme su Bibot.
        </p>
      </section>

      <section className="ap-card ap-card-pad">
        <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Tag</h3>
        <TagEditor contactId={contactId} initial={tags} suggestions={tagSuggestions} add={addCondominoTag} remove={removeCondominoTag} />
      </section>

      {groups.map((g) => {
        const visibleFields = g.fields.filter((f) => !HIDDEN_FROM_GROUPS.has(f.id))
        if (visibleFields.length === 0) return null
        const isOpen = openGroups[g.title]
        return (
          <section key={g.title} className="ap-card">
            <button
              type="button"
              onClick={() => setOpenGroups((prev) => ({ ...prev, [g.title]: !prev[g.title] }))}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '14px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--ap-text)',
                textAlign: 'left',
              }}
            >
              <span>{g.title} <span style={{ color: 'var(--ap-text-faint)', fontWeight: 500 }}>· {visibleFields.length}</span></span>
              <span style={{ color: 'var(--ap-text-muted)', fontSize: 14 }}>{isOpen ? '▾' : '▸'}</span>
            </button>
            {isOpen && (
              <div style={{ padding: '4px 18px 18px', borderTop: '1px solid var(--ap-line)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                {visibleFields.map((f) => (
                  <FieldRow
                    key={f.id}
                    contactId={contactId}
                    fieldId={f.id}
                    label={f.label}
                    initial={customFields[f.id] ?? ''}
                    type={inputType(f.dataType)}
                    inputMode={inputMode(f.dataType)}
                    options={f.picklistOptions}
                    multiline={f.dataType === 'TEXTAREA'}
                    save={updateCondominoField}
                  />
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

function inputType(dt: string): string {
  switch (dt.toUpperCase()) {
    case 'EMAIL': return 'email'
    case 'PHONE': return 'tel'
    case 'DATE': return 'date'
    case 'NUMERICAL':
    case 'NUMBER': return 'text'
    default: return 'text'
  }
}

function inputMode(dt: string): 'numeric' | 'decimal' | 'tel' | 'email' | 'text' | undefined {
  switch (dt.toUpperCase()) {
    case 'NUMERICAL':
    case 'NUMBER': return 'decimal'
    case 'PHONE': return 'tel'
    default: return undefined
  }
}
