'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import ContactDrawer from './ContactDrawer'
import { deleteContact } from '../_actions'
import type { ContactColumn } from '../../settings/_actions'

type Contact = Record<string, unknown> & { id: string }

const TAG_COLORS: Record<string, string> = {
  energia:      'bg-amber-50 text-amber-700 border-amber-200',
  telefonia:    'bg-blue-50 text-blue-700 border-blue-200',
  windtre:      'bg-purple-50 text-purple-700 border-purple-200',
  wind:         'bg-purple-50 text-purple-700 border-purple-200',
  fastweb:      'bg-orange-50 text-orange-700 border-orange-200',
  kena:         'bg-violet-50 text-violet-700 border-violet-200',
  connettivita: 'bg-teal-50 text-teal-700 border-teal-200',
  luce:         'bg-yellow-50 text-yellow-700 border-yellow-200',
  gas:          'bg-amber-50 text-amber-800 border-amber-200',
}

interface CustomFieldDef {
  id: string
  name: string
  fieldKey: string
  dataType: string
  placeholder?: string
}

interface Props {
  contacts: Contact[]
  locationId: string
  columns: ContactColumn[]
  customFields?: CustomFieldDef[]
  availableTags?: string[]
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

function getCellValue(contact: Contact, col: ContactColumn): React.ReactNode {
  // Custom field
  if (col.type === 'custom') {
    return getCustomFieldValue(contact, col.key) || '—'
  }

  // Merged name
  if (col.key === 'contactName') {
    return String(
      contact.contactName ?? contact.name ?? ([contact.firstName, contact.lastName].filter(Boolean).join(' ') || '—')
    )
  }

  // Tags
  if (col.key === 'tags') {
    const tags = Array.isArray(contact.tags) ? contact.tags : []
    if (tags.length === 0) return '—'
    return (
      <div className="flex flex-wrap gap-1">
        {tags.slice(0, 4).map((tag: string) => (
          <span
            key={tag}
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
              TAG_COLORS[tag.toLowerCase()] ?? 'bg-gray-50 text-gray-600 border-gray-200'
            }`}
          >
            {tag}
          </span>
        ))}
      </div>
    )
  }

  // DND boolean
  if (col.key === 'dnd') {
    return contact.dnd ? 'Yes' : 'No'
  }

  // Date fields
  if (DATE_FIELDS.has(col.key)) {
    return formatDate(contact[col.key])
  }

  // Default
  const val = contact[col.key]
  if (val === null || val === undefined || val === '') return '—'
  return String(val)
}

export default function ContactsList({ contacts, locationId, columns, customFields = [], availableTags = [] }: Props) {
  const router = useRouter()
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [editContactId, setEditContactId] = useState<string | null>(null)
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
          router.refresh()
        }
        setDeletingId(null)
      })
    } else {
      setConfirmDeleteId(contactId)
      // Auto-dismiss after 3 seconds
      setTimeout(() => setConfirmDeleteId((prev) => prev === contactId ? null : prev), 3000)
    }
  }

  function handleEdit(contactId: string, e: React.MouseEvent) {
    e.stopPropagation()
    setEditContactId(contactId)
  }

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        {contacts.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-gray-500">Nessun contatto trovato.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 whitespace-nowrap"
                  >
                    {col.label}
                  </th>
                ))}
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400 w-20">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {contacts.map((c) => (
                <tr
                  key={c.id}
                  className="group cursor-pointer transition-colors hover:bg-gray-50"
                  onClick={() => setSelectedContactId(c.id)}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-5 py-3 ${
                        col.key === 'contactName' ? 'font-medium text-gray-900' : 'text-gray-500'
                      } ${DATE_FIELDS.has(col.key) || col.key === 'phone' ? 'whitespace-nowrap' : ''}`}
                    >
                      {getCellValue(c, col)}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      {/* Edit */}
                      <button
                        onClick={(e) => handleEdit(c.id, e)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-[rgba(42,0,204,0.08)] hover:text-[#2A00CC]"
                        title="Modifica"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M10.5 1.5l2 2-8 8H2.5v-2l8-8z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                      {/* Delete */}
                      <button
                        onClick={(e) => handleDelete(c.id, e)}
                        disabled={deletingId === c.id}
                        className={`flex h-7 items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                          confirmDeleteId === c.id
                            ? 'bg-red-600 text-white px-2'
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
        )}
      </div>

      {(selectedContactId || editContactId) && (
        <ContactDrawer
          contactId={editContactId ?? selectedContactId}
          locationId={locationId}
          customFieldDefs={customFields}
          availableTags={availableTags}
          initialTab={editContactId ? 'edit' : 'info'}
          onClose={() => { setSelectedContactId(null); setEditContactId(null) }}
        />
      )}
    </>
  )
}
