'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import ContactDrawer from './ContactDrawer'
import { deleteContact } from '../_actions'
import type { ContactColumn } from '../../settings/_actions'

type Contact = Record<string, unknown> & { id: string }

const TAG_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  energia:      { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400' },
  telefonia:    { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-400' },
  windtre:      { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-400' },
  wind:         { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-400' },
  fastweb:      { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-400' },
  kena:         { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-400' },
  connettivita: { bg: 'bg-teal-50',   text: 'text-teal-700',   dot: 'bg-teal-400' },
  luce:         { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-400' },
  gas:          { bg: 'bg-amber-50',  text: 'text-amber-800',  dot: 'bg-amber-500' },
}

// Pastel color palette for hash-based tag color assignment
const PASTEL_PALETTE: { bg: string; text: string; dot: string }[] = [
  { bg: 'bg-sky-50',     text: 'text-sky-700',     dot: 'bg-sky-400' },
  { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  { bg: 'bg-rose-50',    text: 'text-rose-700',    dot: 'bg-rose-400' },
  { bg: 'bg-violet-50',  text: 'text-violet-700',  dot: 'bg-violet-400' },
  { bg: 'bg-orange-50',  text: 'text-orange-700',  dot: 'bg-orange-400' },
  { bg: 'bg-teal-50',    text: 'text-teal-700',    dot: 'bg-teal-400' },
  { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  { bg: 'bg-pink-50',    text: 'text-pink-700',    dot: 'bg-pink-400' },
  { bg: 'bg-indigo-50',  text: 'text-indigo-700',  dot: 'bg-indigo-400' },
  { bg: 'bg-lime-50',    text: 'text-lime-700',    dot: 'bg-lime-400' },
  { bg: 'bg-cyan-50',    text: 'text-cyan-700',    dot: 'bg-cyan-400' },
  { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', dot: 'bg-fuchsia-400' },
  { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-400' },
  { bg: 'bg-green-50',   text: 'text-green-700',   dot: 'bg-green-400' },
  { bg: 'bg-purple-50',  text: 'text-purple-700',  dot: 'bg-purple-400' },
  { bg: 'bg-red-50',     text: 'text-red-600',     dot: 'bg-red-400' },
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash)
}

function getTagColors(tag: string): { bg: string; text: string; dot: string } {
  const explicit = TAG_COLORS[tag.toLowerCase()]
  if (explicit) return explicit
  const index = hashString(tag.toLowerCase()) % PASTEL_PALETTE.length
  return PASTEL_PALETTE[index]
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  telefonia:             { bg: 'bg-blue-100/80',    text: 'text-blue-800',    border: 'border-blue-200/80' },
  energia:               { bg: 'bg-amber-100/80',   text: 'text-amber-800',   border: 'border-amber-200/80' },
  'connettività casa':   { bg: 'bg-emerald-100/80', text: 'text-emerald-800', border: 'border-emerald-200/80' },
  connettivita:          { bg: 'bg-emerald-100/80', text: 'text-emerald-800', border: 'border-emerald-200/80' },
  intrattenimento:       { bg: 'bg-purple-100/80',  text: 'text-purple-800',  border: 'border-purple-200/80' },
}

const DEFAULT_CAT = { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' }

interface CustomFieldDef {
  id: string
  name: string
  fieldKey: string
  dataType: string
  placeholder?: string
  picklistOptions?: string[]
}

interface Props {
  contacts: Contact[]
  locationId: string
  columns: ContactColumn[]
  customFields?: CustomFieldDef[]
  availableTags?: string[]
  categoryTags?: Record<string, string[]>
}

function formatDate(val: unknown): string {
  if (!val || typeof val !== 'string') return '—'
  const d = new Date(val)
  if (isNaN(d.getTime())) return String(val)
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getCustomFieldValue(contact: Contact, fieldId: string): string {
  const cfArray = contact.customFields
  if (!Array.isArray(cfArray)) return ''
  const field = cfArray.find((f: Record<string, unknown>) => f.id === fieldId)
  if (!field) return ''
  const val = field.value ?? field.field_value ?? field.fieldValue ?? ''
  return String(val)
}

const DATE_FIELDS = new Set(['dateAdded', 'lastActivity', 'dateOfBirth', 'dateUpdated'])

function formatCustomFieldValue(val: string): string {
  if (!val) return '—'
  if (/^\d{4}-\d{2}-\d{2}T/.test(val)) {
    const d = new Date(val)
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, d] = val.split('-')
    return `${d}/${m}/${y}`
  }
  return val
}

function getCellValue(contact: Contact, col: ContactColumn): React.ReactNode {
  // Custom field
  if (col.type === 'custom') {
    const raw = getCustomFieldValue(contact, col.key)
    // Categoria gets colored badge(s) — supports comma-separated multi-values
    if (col.label === 'Categoria' && raw) {
      const catValues = raw.split(',').map(s => s.trim()).filter(Boolean)
      return (
        <div className="flex flex-wrap gap-1">
          {catValues.map((cat) => {
            const colors = CATEGORY_COLORS[cat.toLowerCase()] ?? DEFAULT_CAT
            return (
              <span key={cat} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${colors.bg} ${colors.text} ${colors.border}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${colors.border.replace('border-', 'bg-').replace('/80', '')}`} />
                {cat}
              </span>
            )
          })}
        </div>
      )
    }
    return formatCustomFieldValue(raw)
  }

  // Merged name
  if (col.key === 'contactName') {
    const name = String(
      contact.contactName ?? contact.name ?? ([contact.firstName, contact.lastName].filter(Boolean).join(' ') || '—')
    )
    const initials = name.slice(0, 2).toUpperCase()
    return (
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#2A00CC] to-[#6366f1] text-[10px] font-bold text-white">
          {initials !== '—' ? initials : '?'}
        </span>
        <span className="font-semibold text-gray-900">{name}</span>
      </div>
    )
  }

  // Tags
  if (col.key === 'tags') {
    const tags = Array.isArray(contact.tags) ? contact.tags : []
    if (tags.length === 0) return <span className="text-gray-300">—</span>
    const maxVisible = 3
    const visible = tags.slice(0, maxVisible)
    const remaining = tags.length - maxVisible
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {visible.map((tag: string) => {
          const colors = getTagColors(tag)
          return (
            <span
              key={tag}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium leading-5 ${colors.bg} ${colors.text} ring-1 ring-inset ring-current/10`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
              {tag}
            </span>
          )
        })}
        {remaining > 0 && (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500 ring-1 ring-inset ring-gray-200/60" title={tags.slice(maxVisible).join(', ')}>
            +{remaining}
          </span>
        )}
      </div>
    )
  }

  // DND boolean
  if (col.key === 'dnd') {
    return contact.dnd
      ? <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-600 ring-1 ring-inset ring-red-100">DND</span>
      : <span className="text-gray-300/60">—</span>
  }

  // Date fields
  if (DATE_FIELDS.has(col.key)) {
    return formatDate(contact[col.key])
  }

  // Email with subtle styling
  if (col.key === 'email') {
    const val = contact[col.key]
    if (!val) return <span className="text-gray-300/60">—</span>
    return (
      <span className="inline-flex items-center gap-1.5 text-gray-600">
        <svg className="h-3.5 w-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
        </svg>
        <span className="truncate">{String(val)}</span>
      </span>
    )
  }

  // Phone
  if (col.key === 'phone') {
    const val = contact[col.key]
    if (!val) return <span className="text-gray-300/60">—</span>
    return (
      <span className="inline-flex items-center gap-1.5 text-gray-600">
        <svg className="h-3.5 w-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
        </svg>
        <span className="font-mono text-xs tabular-nums">{String(val)}</span>
      </span>
    )
  }

  // Default
  const val = contact[col.key]
  if (val === null || val === undefined || val === '') return <span className="text-gray-300/60">—</span>
  return String(val)
}

export default function ContactsList({ contacts: serverContacts, locationId, columns, customFields = [], availableTags = [], categoryTags = {} }: Props) {
  const router = useRouter()
  const [localContacts, setLocalContacts] = useState<Contact[]>(serverContacts)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [editContactId, setEditContactId] = useState<string | null>(null)

  // Sync with server when props change
  useEffect(() => {
    setLocalContacts(serverContacts)
  }, [serverContacts])

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [, startDelete] = useTransition()

  function handleDelete(contactId: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (confirmDeleteId === contactId) {
      setDeletingId(contactId)
      startDelete(async () => {
        const result = await deleteContact(locationId, contactId)
        if (!result.error) {
          setConfirmDeleteId(null)
          setLocalContacts((prev) => prev.filter((c) => c.id !== contactId))
          router.refresh()
        }
        setDeletingId(null)
      })
    } else {
      setConfirmDeleteId(contactId)
      setTimeout(() => setConfirmDeleteId((prev) => prev === contactId ? null : prev), 3000)
    }
  }

  function handleEdit(contactId: string, e: React.MouseEvent) {
    e.stopPropagation()
    setEditContactId(contactId)
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-gray-200/60 bg-white shadow-sm">
        {localContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </div>
            <p className="mt-4 text-sm font-medium text-gray-500">Nessun contatto trovato.</p>
            <p className="mt-1 text-xs text-gray-400">Prova a modificare i filtri o crea un nuovo contatto.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200/60 bg-gray-50/60">
                  <th className="px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400 w-12">
                    #
                  </th>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap"
                    >
                      {col.label}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400 w-20">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody>
                {localContacts.map((c, index) => (
                  <tr
                    key={c.id}
                    className="group cursor-pointer border-b border-gray-100/70 bg-white transition-colors duration-150 hover:bg-indigo-50/30"
                    onClick={() => setSelectedContactId(c.id)}
                  >
                    <td className="px-3 py-3.5 text-center">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-gray-100/80 text-[10px] font-bold tabular-nums text-gray-400">
                        {index + 1}
                      </span>
                    </td>
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3.5 ${
                          DATE_FIELDS.has(col.key) || col.key === 'phone' ? 'whitespace-nowrap' : ''
                        } ${col.key === 'contactName' ? '' : 'text-gray-500'}`}
                      >
                        {getCellValue(c, col)}
                      </td>
                    ))}
                    <td className="px-3 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={(e) => handleEdit(c.id, e)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-[rgba(42,0,204,0.08)] hover:text-[#2A00CC]"
                          title="Modifica"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M10.5 1.5l2 2-8 8H2.5v-2l8-8z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                        <button
                          onClick={(e) => handleDelete(c.id, e)}
                          disabled={deletingId === c.id}
                          className={`flex h-7 items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                            confirmDeleteId === c.id
                              ? 'bg-red-600 text-white px-2.5 opacity-100'
                              : 'w-7 text-gray-400 hover:bg-red-50 hover:text-red-500'
                          } disabled:opacity-50`}
                          title={confirmDeleteId === c.id ? 'Conferma' : 'Elimina'}
                        >
                          {deletingId === c.id ? (
                            <div className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                          ) : confirmDeleteId === c.id ? (
                            'Conferma'
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <path d="M2 4h10M5 4V2.5h4V4M3.5 4v7.5a1 1 0 001 1h5a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(selectedContactId || editContactId) && (
        <ContactDrawer
          contactId={editContactId ?? selectedContactId}
          locationId={locationId}
          customFieldDefs={customFields}
          availableTags={availableTags}
          categoryTags={categoryTags}
          initialTab={editContactId ? 'edit' : 'info'}
          onClose={() => { setSelectedContactId(null); setEditContactId(null) }}
          onContactUpdated={(id, data) => {
            setLocalContacts((prev) => prev.map((c) => {
              if (c.id !== id) return c
              return {
                ...c,
                ...data,
                contactName: [data.firstName, data.lastName].filter(Boolean).join(' ') || (c as Record<string, unknown>).contactName,
                name: [data.firstName, data.lastName].filter(Boolean).join(' ') || (c as Record<string, unknown>).name,
              } as Contact
            }))
          }}
        />
      )}
    </>
  )
}
