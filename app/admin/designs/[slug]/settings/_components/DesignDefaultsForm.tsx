'use client'

import { useState } from 'react'
import { saveDesignDefaults } from '../_actions'
import type { DesignTheme, DesignModules } from '@/lib/types/design'

const MODULE_KEYS = ['dashboard', 'contacts', 'pipeline', 'calendar', 'settings'] as const
type ModuleKey = typeof MODULE_KEYS[number]

const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: 'Dashboard', contacts: 'Contatti', pipeline: 'Pipeline',
  calendar: 'Calendario', settings: 'Impostazioni',
}

interface Props {
  slug: string
  name: string
  theme: DesignTheme
  modules: DesignModules
  priceMonthly: number | null
}

export default function DesignDefaultsForm({ slug, name: initialName, theme: initialTheme, modules: initialModules, priceMonthly: initialPrice }: Props) {
  const [name, setName] = useState(initialName)
  const [theme, setTheme] = useState<DesignTheme>(initialTheme)
  const [modules, setModules] = useState<DesignModules>(initialModules)
  const [priceMonthly, setPriceMonthly] = useState(initialPrice != null ? String(initialPrice) : '')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null)

  function setModuleEnabled(key: ModuleKey, enabled: boolean) {
    setModules((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? {}), enabled },
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setResult(null)

    const finalModules: DesignModules = { ...modules }

    const parsedPrice = priceMonthly.trim() ? parseFloat(priceMonthly) : null
    if (priceMonthly.trim() && (isNaN(parsedPrice!) || parsedPrice! < 0)) {
      setResult({ error: 'Prezzo mensile non valido' })
      return
    }

    setSaving(true)
    const res = await saveDesignDefaults(slug, name, theme, finalModules, parsedPrice)
    setSaving(false)
    setResult(res?.error ? { error: res.error } : { ok: true })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Design Name */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-bold text-gray-800 mb-4">Nome Design</h2>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
          placeholder="Es. Simfonia"
        />
      </div>

      {/* Pricing */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-bold text-gray-800 mb-4">Prezzo Mensile</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-500">€</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={priceMonthly}
            onChange={(e) => setPriceMonthly(e.target.value)}
            placeholder="Es. 99.00"
            className="w-40 rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
          <span className="text-xs text-gray-400">/ mese — usato per calcolare l&apos;MRR</span>
        </div>
      </div>

      {/* Theme */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-bold text-gray-800 mb-4">Tema Visivo</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1.5">Colore Primario</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={theme.primaryColor}
                onChange={(e) => setTheme((t) => ({ ...t, primaryColor: e.target.value }))}
                className="h-10 w-12 cursor-pointer rounded-lg border border-gray-200 p-0.5"
              />
              <input
                type="text"
                value={theme.primaryColor}
                onChange={(e) => setTheme((t) => ({ ...t, primaryColor: e.target.value }))}
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-mono"
                pattern="^#[0-9a-fA-F]{6}$"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1.5">Colore Secondario</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={theme.secondaryColor}
                onChange={(e) => setTheme((t) => ({ ...t, secondaryColor: e.target.value }))}
                className="h-10 w-12 cursor-pointer rounded-lg border border-gray-200 p-0.5"
              />
              <input
                type="text"
                value={theme.secondaryColor}
                onChange={(e) => setTheme((t) => ({ ...t, secondaryColor: e.target.value }))}
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-mono"
                pattern="^#[0-9a-fA-F]{6}$"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1.5">Nome Azienda</label>
            <input
              type="text"
              value={theme.companyName}
              onChange={(e) => setTheme((t) => ({ ...t, companyName: e.target.value }))}
              required
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1.5">Logo Text (max 3 char)</label>
            <input
              type="text"
              value={theme.logoText}
              onChange={(e) => setTheme((t) => ({ ...t, logoText: e.target.value.slice(0, 3) }))}
              maxLength={3}
              required
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1.5">Logo URL (opzionale)</label>
            <input
              type="url"
              value={theme.logoUrl ?? ''}
              onChange={(e) => setTheme((t) => ({ ...t, logoUrl: e.target.value || undefined }))}
              placeholder="https://..."
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Modules */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-bold text-gray-800 mb-4">Moduli</h2>
        <div className="grid grid-cols-3 gap-3">
          {MODULE_KEYS.map((key) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={modules[key]?.enabled !== false}
                onChange={(e) => setModuleEnabled(key, e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm font-medium text-gray-700">{MODULE_LABELS[key]}</span>
            </label>
          ))}
        </div>

      </div>

      {/* Live preview */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-bold text-gray-800 mb-4">Anteprima Sidebar</h2>
        <div
          className="w-48 rounded-xl p-4 text-white"
          style={{ background: `linear-gradient(180deg, ${theme.primaryColor} 0%, ${theme.primaryColor}cc 100%)` }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black"
              style={{ background: `${theme.secondaryColor}33`, color: theme.secondaryColor, border: `1px solid ${theme.secondaryColor}55` }}
            >
              {theme.logoText}
            </div>
            <span className="text-xs font-bold">{theme.companyName}</span>
          </div>
          {MODULE_KEYS.filter((k) => modules[k]?.enabled !== false).map((k) => (
            <div key={k} className="rounded-lg px-2 py-1 text-xs text-white/70 mb-0.5">
              {MODULE_LABELS[k]}
            </div>
          ))}
        </div>
      </div>

      {result?.error && (
        <p className="text-sm text-red-600 font-medium">{result.error}</p>
      )}
      {result?.ok && (
        <p className="text-sm text-green-600 font-medium">Salvato con successo.</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl py-3 text-sm font-bold text-black transition-all hover:opacity-90 disabled:opacity-50"
        style={{ background: '#00F0FF' }}
      >
        {saving ? 'Salvataggio...' : 'Salva Design'}
      </button>
    </form>
  )
}
