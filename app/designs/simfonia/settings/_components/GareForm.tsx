'use client'

import { useState, useTransition } from 'react'
import { saveGareMensili, type GaraRow } from '../_actions'
import { sf } from '@/lib/simfonia/ui'

const accentFill = {
  background: 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 88%, white) 100%)',
} as const

interface Props {
  locationId: string
  month: string // 'YYYY-MM-01'
  initialRows: GaraRow[]
  gestoriOptions: string[]
  demoMode?: boolean
}

export default function GareForm({ locationId, month, initialRows, gestoriOptions, demoMode = false }: Props) {
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
    if (demoMode) {
      setMessage({ text: 'Demo aggiornata', error: false })
      return
    }
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
        <div className={sf.tableShell}>
          <table className="w-full text-sm">
            <thead>
              <tr className={sf.tableHeadRow}>
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
                    <span className="inline-flex items-center rounded-full border border-brand/25 bg-brand/5 px-3 py-1 text-xs font-semibold text-brand">
                      {row.categoria}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min="0"
                      value={row.obiettivo}
                      onChange={(e) => updateObiettivo(i, parseInt(e.target.value) || 0)}
                      disabled={demoMode}
                      className={`w-24 ${sf.inputSm} font-semibold`}
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      disabled={demoMode}
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
      <GestoreSelector availableGestori={availableGestori} onSelect={addGestore} disabled={demoMode} />

      {message && (
        <p className={`text-sm font-medium ${message.error ? 'text-red-600' : 'text-green-600'}`}>
          {message.text}
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={demoMode || isPending}
        className={`${sf.btnSave} font-bold`}
        style={accentFill}
      >
        {isPending ? 'Salvataggio…' : 'Salva gare'}
      </button>
    </div>
  )
}

function GestoreSelector({ availableGestori, onSelect, disabled = false }: { availableGestori: string[]; onSelect: (g: string) => void; disabled?: boolean }) {
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
          onFocus={() => !disabled && setOpen(true)}
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && filtered.length === 1) {
              e.preventDefault()
              select(filtered[0])
            }
            if (e.key === 'Escape') setOpen(false)
          }}
          placeholder="Cerca gestore per aggiungere gara..."
          className={`flex-1 ${sf.inputFull} py-2`}
        />
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-2xl border border-gray-200/80 bg-white/95 shadow-xl backdrop-blur-sm">
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
        <div className="absolute left-0 right-0 z-10 mt-1 rounded-2xl border border-gray-200/80 bg-white/95 p-3 shadow-xl backdrop-blur-sm">
          <p className="text-xs text-gray-400">Nessun gestore trovato per &quot;{query}&quot;</p>
        </div>
      )}
    </div>
  )
}
