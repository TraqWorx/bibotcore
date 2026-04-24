'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import SendMessageModal from './SendMessageModal'
import ContactDrawer from './ContactDrawer'

interface Contact {
  id: string
  contactName: string
  email: string | null
  phone: string | null
  city: string | null
  tags: string[]
  dateAdded: string | null
  customFields: Record<string, string>
}

interface SmartList {
  id: string
  name: string
  field: string
  value: string
}

const DEMO_CONTACTS: Contact[] = [
  { id: 'dc-1', contactName: 'Maria Bianchi', email: 'maria@example.it', phone: '+39 340 111 2233', city: 'Bari', tags: ['hotel', 'premium'], dateAdded: '2026-04-10', customFields: {} },
  { id: 'dc-2', contactName: 'Giuseppe Ferro', email: 'giuseppe@example.it', phone: '+39 328 444 5566', city: 'Lecce', tags: ['tour-operator'], dateAdded: '2026-04-08', customFields: {} },
  { id: 'dc-3', contactName: 'Anna Russo', email: 'anna@example.it', phone: '+39 347 777 8899', city: 'Taranto', tags: ['b&b', 'new'], dateAdded: '2026-04-05', customFields: {} },
  { id: 'dc-4', contactName: 'Luca Gentile', email: 'luca@example.it', phone: '+39 333 222 1100', city: 'Ostuni', tags: ['restaurant'], dateAdded: '2026-04-03', customFields: {} },
  { id: 'dc-5', contactName: 'Francesca Moretti', email: 'francesca@example.it', phone: '+39 345 999 0011', city: 'Polignano', tags: ['hotel', 'partner'], dateAdded: '2026-03-28', customFields: {} },
  { id: 'dc-6', contactName: 'Marco De Santis', email: 'marco@example.it', phone: '+39 338 666 7788', city: 'Bari', tags: ['tour-operator', 'premium'], dateAdded: '2026-03-25', customFields: {} },
]

export default function ContactsClient({ locationId, demoMode = false }: { locationId: string; demoMode?: boolean }) {
  const [contacts, setContacts] = useState<Contact[]>(demoMode ? DEMO_CONTACTS : [])
  const [loading, setLoading] = useState(!demoMode)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [smartLists, setSmartLists] = useState<SmartList[]>([])
  const [activeList, setActiveList] = useState<string | null>(null)
  const [showSendModal, setShowSendModal] = useState(false)
  const [customFields, setCustomFields] = useState<{ key: string; name: string }[]>([])
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)

  // Smart list form
  const [listFormMode, setListFormMode] = useState<'none' | 'create' | 'edit'>('none')
  const [editingListId, setEditingListId] = useState<string | null>(null)
  const [listName, setListName] = useState('')
  const [listField, setListField] = useState('')
  const [listValue, setListValue] = useState('')

  // Load contacts
  useEffect(() => {
    if (demoMode) return
    fetch('/api/contacts?locationId=' + locationId)
      .then((r) => r.json())
      .then((data) => {
        const raw = data.contacts ?? []
        const mapped = raw.map((c: Record<string, unknown>) => {
          const cf: Record<string, string> = {}
          for (const f of (c.customFields ?? []) as { id: string; value: unknown }[]) {
            if (f.value) cf[f.id] = String(f.value)
          }
          return {
            id: c.id as string,
            contactName: (`${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.contactName || '—') as string,
            email: (c.email as string) ?? null,
            phone: (c.phone as string) ?? null,
            city: (c.city as string) ?? null,
            tags: (c.tags ?? []) as string[],
            dateAdded: (c.dateAdded as string) ?? null,
            customFields: cf,
          }
        })
        setContacts(mapped)

        const fieldMap = new Map<string, string>()
        for (const c of mapped) {
          for (const [k] of Object.entries(c.customFields)) {
            if (!fieldMap.has(k)) fieldMap.set(k, k)
          }
        }
        setCustomFields([...fieldMap.entries()].map(([key, name]) => ({ key, name })))
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    const saved = localStorage.getItem(`smartLists-${locationId}`)
    if (saved) {
      try { setSmartLists(JSON.parse(saved)) } catch { /* ignore */ }
    }
  }, [locationId, demoMode])

  function saveSmartLists(lists: SmartList[]) {
    setSmartLists(lists)
    localStorage.setItem(`smartLists-${locationId}`, JSON.stringify(lists))
  }

  const filtered = useMemo(() => {
    let result = contacts
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((c) => c.contactName.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q) || c.city?.toLowerCase().includes(q))
    }
    if (activeList) {
      const list = smartLists.find((l) => l.id === activeList)
      if (list) {
        result = result.filter((c) => {
          if (list.field === 'city') return c.city?.toLowerCase() === list.value.toLowerCase()
          if (list.field === 'tags') return c.tags.some((t) => t.toLowerCase() === list.value.toLowerCase())
          return c.customFields[list.field]?.toLowerCase() === list.value.toLowerCase()
        })
      }
    }
    return result
  }, [contacts, search, activeList, smartLists])

  const allSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id))

  function toggleAll() {
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(filtered.map((c) => c.id)))
  }

  function toggleOne(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  function resetListForm() {
    setListFormMode('none')
    setEditingListId(null)
    setListName('')
    setListField('')
    setListValue('')
  }

  function openCreateList() {
    resetListForm()
    setListFormMode('create')
  }

  function openEditList(list: SmartList) {
    setListFormMode('edit')
    setEditingListId(list.id)
    setListName(list.name)
    setListField(list.field)
    setListValue(list.value)
  }

  function handleSaveList() {
    if (!listName.trim() || !listField || !listValue.trim()) return
    if (listFormMode === 'edit' && editingListId) {
      saveSmartLists(smartLists.map((l) => l.id === editingListId ? { ...l, name: listName.trim(), field: listField, value: listValue.trim() } : l))
    } else {
      const newList: SmartList = { id: Date.now().toString(), name: listName.trim(), field: listField, value: listValue.trim() }
      saveSmartLists([...smartLists, newList])
    }
    resetListForm()
  }

  function handleDeleteList(id: string) {
    saveSmartLists(smartLists.filter((l) => l.id !== id))
    if (activeList === id) setActiveList(null)
  }

  const selectedContacts = contacts.filter((c) => selectedIds.has(c.id))
  const qs = locationId ? `?locationId=${locationId}` : ''

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-brand" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Contatti</h1>
          <p className="text-xs" style={{ color: 'var(--shell-muted)' }}>{contacts.length} totale</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={() => setShowSendModal(true)}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
              style={{ backgroundColor: 'var(--brand)' }}
            >
              Invia Messaggio ({selectedIds.size})
            </button>
          )}
          {!demoMode && (
            <Link
              href={`/designs/apulia-tourism/contacts/new${qs}`}
              className="rounded-xl border px-4 py-2.5 text-sm font-semibold transition hover:bg-black/5"
              style={{ borderColor: 'var(--shell-line)', color: 'var(--foreground)' }}
            >
              + Aggiungi Contatto
            </Link>
          )}
        </div>
      </div>

      {/* Smart Lists */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setActiveList(null)}
          className="rounded-full border px-3 py-1 text-xs font-semibold transition"
          style={!activeList ? { borderColor: 'var(--brand)', backgroundColor: 'color-mix(in srgb, var(--brand) 10%, transparent)', color: 'var(--brand)' } : { borderColor: '#e5e7eb', color: '#6b7280' }}
        >
          Tutti i Contatti
        </button>
        {smartLists.map((list) => (
          <div key={list.id} className="group flex items-center gap-0.5">
            <button
              onClick={() => setActiveList(activeList === list.id ? null : list.id)}
              className="rounded-full border px-3 py-1 text-xs font-semibold transition"
              style={activeList === list.id ? { borderColor: 'var(--brand)', backgroundColor: 'color-mix(in srgb, var(--brand) 10%, transparent)', color: 'var(--brand)' } : { borderColor: '#e5e7eb', color: '#6b7280' }}
            >
              {list.name}
            </button>
            <button onClick={() => openEditList(list)} className="rounded-full p-0.5 text-gray-300 opacity-0 transition hover:text-blue-500 group-hover:opacity-100" title="Modifica lista">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
            </button>
            <button onClick={() => handleDeleteList(list.id)} className="rounded-full p-0.5 text-gray-300 opacity-0 transition hover:text-red-500 group-hover:opacity-100" title="Elimina lista">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        ))}
        {listFormMode === 'none' ? (
          <button onClick={openCreateList} className="rounded-full border border-dashed border-gray-300 px-3 py-1 text-xs text-gray-400 hover:border-gray-400 hover:text-gray-600">
            + Nuova Lista
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-2 shadow-sm">
            <input type="text" value={listName} onChange={(e) => setListName(e.target.value)} placeholder="Nome lista" className="rounded-lg border border-gray-200 px-2 py-1 text-xs outline-none w-24" />
            <select value={listField} onChange={(e) => setListField(e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1 text-xs outline-none">
              <option value="">Campo...</option>
              <option value="city">Città</option>
              <option value="tags">Tag</option>
              {customFields.map((f) => <option key={f.key} value={f.key}>{f.name}</option>)}
            </select>
            <input type="text" value={listValue} onChange={(e) => setListValue(e.target.value)} placeholder="Valore" className="rounded-lg border border-gray-200 px-2 py-1 text-xs outline-none w-24" />
            <button onClick={handleSaveList} className="rounded-lg bg-gray-900 px-2 py-1 text-xs font-semibold text-white">
              {listFormMode === 'edit' ? 'Aggiorna' : 'Salva'}
            </button>
            <button onClick={resetListForm} className="text-xs text-gray-400">Annulla</button>
          </div>
        )}
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cerca contatti..."
        className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none"
        style={{ borderColor: 'var(--shell-line)', backgroundColor: 'var(--shell-surface)', color: 'var(--foreground)' }}
      />

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border shadow-sm" style={{ borderColor: 'var(--shell-line)', backgroundColor: 'var(--shell-surface)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--shell-line)' }}>
              <th className="px-4 py-3 text-left">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--shell-muted)' }}>Nome</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--shell-muted)' }}>Telefono</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--shell-muted)' }}>Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--shell-muted)' }}>Città</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--shell-muted)' }}>Tag</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((c) => (
              <tr
                key={c.id}
                className="cursor-pointer transition-colors hover:brightness-95"
                style={{ borderBottom: '1px solid var(--shell-line)' }}
                onClick={() => setSelectedContactId(c.id)}
              >
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleOne(c.id)} className="rounded" />
                </td>
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--foreground)' }}>{c.contactName || '—'}</td>
                <td className="px-4 py-3 text-xs" style={{ color: 'var(--shell-muted)' }}>{c.phone || '—'}</td>
                <td className="px-4 py-3 text-xs" style={{ color: 'var(--shell-muted)' }}>{c.email || '—'}</td>
                <td className="px-4 py-3 text-xs" style={{ color: 'var(--shell-muted)' }}>{c.city || '—'}</td>
                <td className="px-4 py-3">
                  {c.tags.slice(0, 3).map((t) => (
                    <span key={t} className="mr-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: 'var(--shell-soft)', color: 'var(--brand)' }}>{t}</span>
                  ))}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--shell-muted)' }}>Nessun contatto trovato</td></tr>
            )}
          </tbody>
        </table>
        {filtered.length > 100 && (
          <p className="px-4 py-2 text-xs" style={{ color: 'var(--shell-muted)' }}>Mostrati 100 di {filtered.length}</p>
        )}
      </div>

      {/* Send Message Modal */}
      {showSendModal && (
        <SendMessageModal
          locationId={locationId}
          contacts={selectedContacts}
          onClose={() => setShowSendModal(false)}
        />
      )}

      {/* Contact Drawer */}
      {selectedContactId && (
        <ContactDrawer
          contactId={selectedContactId}
          locationId={locationId}
          onClose={() => setSelectedContactId(null)}
          demoContact={demoMode ? contacts.find((c) => c.id === selectedContactId) ?? null : undefined}
        />
      )}
    </div>
  )
}
