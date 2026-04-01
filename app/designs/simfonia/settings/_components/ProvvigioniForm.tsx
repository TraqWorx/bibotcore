'use client'

import { useState, useTransition } from 'react'
import { saveProvvigioni, type ProvvigioneRow } from '../_actions'
import { sf } from '@/lib/simfonia/ui'

const accentFill = {
  background: 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 88%, white) 100%)',
} as const

interface Props {
  locationId: string
  initialRows: ProvvigioneRow[]
}

export default function ProvvigioniForm({ locationId, initialRows }: Props) {
  const [rows, setRows] = useState<ProvvigioneRow[]>(initialRows)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  function addRow() {
    setRows((prev) => [...prev, { nome: '', tipo: 'fisso', valore: 0, ordine: prev.length }])
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  function updateRow(index: number, field: keyof ProvvigioneRow, value: string | number) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    )
  }

  function handleSave() {
    startTransition(async () => {
      setMessage(null)
      const result = await saveProvvigioni(locationId, rows)
      if (result.error) {
        setMessage({ text: result.error, error: true })
      } else {
        setMessage({ text: 'Salvato!', error: false })
        setTimeout(() => setMessage(null), 2000)
      }
    })
  }

  const inputClass = sf.inputSm + ' w-full'

  return (
    <div className="space-y-4">
      {rows.length === 0 && (
        <p className="text-sm text-gray-400">Nessuna provvigione configurata.</p>
      )}

      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200/60 bg-gray-50/80 p-4 backdrop-blur-sm">
          <div className="flex-1">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-gray-400">Nome</label>
            <input
              type="text"
              className={inputClass}
              placeholder="Es. Gettone Energia Standard"
              value={row.nome}
              onChange={(e) => updateRow(i, 'nome', e.target.value)}
            />
          </div>
          <div className="w-36">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-gray-400">Tipo</label>
            <select
              className={inputClass}
              value={row.tipo}
              onChange={(e) => updateRow(i, 'tipo', e.target.value as 'fisso' | 'percentuale')}
            >
              <option value="fisso">Fisso (&euro;)</option>
              <option value="percentuale">Percentuale (%)</option>
            </select>
          </div>
          <div className="w-28">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-gray-400">Valore</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className={inputClass}
              value={row.valore}
              onChange={(e) => updateRow(i, 'valore', parseFloat(e.target.value) || 0)}
            />
          </div>
          <button
            type="button"
            onClick={() => removeRow(i)}
            className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            &times;
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addRow}
        className="rounded-2xl border border-dashed border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-500 transition-colors hover:border-brand/40 hover:text-brand"
      >
        + Aggiungi Provvigione
      </button>

      {message && (
        <p className={`text-sm font-medium ${message.error ? 'text-red-600' : 'text-emerald-600'}`}>
          {message.text}
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className={`${sf.btnSave} font-bold`}
        style={accentFill}
      >
        {isPending ? 'Salvataggio…' : 'Salva provvigioni'}
      </button>
    </div>
  )
}
