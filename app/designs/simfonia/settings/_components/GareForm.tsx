'use client'

import { useState, useTransition } from 'react'
import { saveGareMensili, type GaraRow } from '../_actions'

interface Props {
  locationId: string
  month: string // 'YYYY-MM-01'
  initialRows: GaraRow[]
  gestoriOptions: string[]
}

export default function GareForm({ locationId, month, initialRows, gestoriOptions }: Props) {
  const [rows, setRows] = useState<GaraRow[]>(initialRows)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  // Gestori already used in rows
  const usedGestori = new Set(rows.map((r) => r.tag.toLowerCase()))

  function updateObiettivo(index: number, value: number) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, obiettivo: value } : r)))
  }

  function addGestore(gestore: string) {
    if (!gestore || usedGestori.has(gestore.toLowerCase())) return
    setRows((prev) => [...prev, { categoria: gestore, tag: gestore.toLowerCase(), obiettivo: 0 }])
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveGareMensili(locationId, month, rows)
      if (result.error) {
        setMessage({ text: result.error, error: true })
      } else {
        setMessage({ text: 'Gare salvate con successo', error: false })
        setTimeout(() => setMessage(null), 3000)
      }
    })
  }

  const monthLabel = new Date(month + 'T00:00:00').toLocaleDateString('it-IT', {
    month: 'long',
    year: 'numeric',
  })

  // Available gestori = options not already added
  const availableGestori = gestoriOptions.filter((g) => !usedGestori.has(g.toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-600 capitalize">{monthLabel}</p>
      </div>

      {rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Gestore
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Obiettivo
                </th>
                <th className="w-10 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row, i) => (
                <tr key={row.tag} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center rounded-full border border-[rgba(42,0,204,0.2)] bg-[rgba(42,0,204,0.05)] px-3 py-1 text-xs font-semibold" style={{ color: '#2A00CC' }}>
                      {row.categoria}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min="0"
                      value={row.obiettivo}
                      onChange={(e) => updateObiettivo(i, parseInt(e.target.value) || 0)}
                      className="w-24 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold outline-none focus:border-[#2A00CC] focus:ring-1 focus:ring-[rgba(42,0,204,0.15)]"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                      title="Rimuovi"
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add gestore selector */}
      <GestoreSelector availableGestori={availableGestori} onSelect={addGestore} />

      {message && (
        <p className={`text-sm font-medium ${message.error ? 'text-red-600' : 'text-green-600'}`}>
          {message.text}
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="w-full rounded-xl py-2.5 text-sm font-bold text-black transition-colors hover:opacity-90 disabled:opacity-50"
        style={{ background: '#00F0FF' }}
      >
        {isPending ? 'Salvataggio...' : 'Salva Gare'}
      </button>
    </div>
  )
}

function GestoreSelector({ availableGestori, onSelect }: { availableGestori: string[]; onSelect: (g: string) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = query.trim()
    ? availableGestori.filter((g) => g.toLowerCase().includes(query.toLowerCase()))
    : availableGestori

  function select(gestore: string) {
    onSelect(gestore)
    setQuery('')
    setOpen(false)
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && filtered.length === 1) {
              e.preventDefault()
              select(filtered[0])
            }
            if (e.key === 'Escape') setOpen(false)
          }}
          placeholder="Cerca gestore per aggiungere gara..."
          className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-[#2A00CC] focus:ring-2 focus:ring-[rgba(42,0,204,0.15)] transition-colors"
        />
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {filtered.map((g) => (
            <button
              key={g}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(g)}
              className="flex w-full items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {g}
            </button>
          ))}
        </div>
      )}

      {open && query && filtered.length === 0 && (
        <div className="absolute left-0 right-0 z-10 mt-1 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
          <p className="text-xs text-gray-400">Nessun gestore trovato per &quot;{query}&quot;</p>
        </div>
      )}
    </div>
  )
}
