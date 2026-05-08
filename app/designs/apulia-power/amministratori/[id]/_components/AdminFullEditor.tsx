'use client'

import { useState } from 'react'
import FieldRow from '../../../_components/FieldRow'
import TagEditor from '../../../_components/TagEditor'
import {
  updateAdminField,
  updateAdminCore,
  addAdminTag,
  removeAdminTag,
} from '../_actions'

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
}

export default function AdminFullEditor({ contactId, core, customFields, tags, tagSuggestions, groups }: Props) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    groups.forEach((g) => { init[g.title] = ['Amministratore condominio', 'Cliente', 'Fatturazione'].includes(g.title) })
    return init
  })

  function saveCore(_: string, fieldId: string, value: string) {
    return updateAdminCore(contactId, fieldId as 'firstName' | 'lastName' | 'email' | 'phone', value)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section className="ap-card ap-card-pad">
        <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>Contatto</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <FieldRow contactId={contactId} fieldId="firstName" label="Nome / Ragione sociale" initial={core.firstName} save={saveCore} />
          <FieldRow contactId={contactId} fieldId="lastName" label="Cognome" initial={core.lastName} save={saveCore} />
          <FieldRow contactId={contactId} fieldId="email" label="Email" type="email" initial={core.email} save={saveCore} />
          <FieldRow contactId={contactId} fieldId="phone" label="Telefono" type="tel" initial={core.phone} save={saveCore} />
        </div>
      </section>

      <section className="ap-card ap-card-pad">
        <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Tag</h3>
        <TagEditor
          contactId={contactId}
          initial={tags}
          suggestions={tagSuggestions}
          protectedTags={['amministratore']}
          add={addAdminTag}
          remove={removeAdminTag}
        />
      </section>

      {groups.map((g) => {
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
              <span>{g.title} <span style={{ color: 'var(--ap-text-faint)', fontWeight: 500 }}>· {g.fields.length}</span></span>
              <span style={{ color: 'var(--ap-text-muted)', fontSize: 14 }}>{isOpen ? '▾' : '▸'}</span>
            </button>
            {isOpen && (
              <div style={{ padding: '4px 18px 18px', borderTop: '1px solid var(--ap-line)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                {g.fields.map((f) => (
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
                    save={updateAdminField}
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
