'use client'

import { useState } from 'react'
import { saveThemeOverrides } from '../_actions'

interface Props {
  locationId: string
  primaryColor: string
  secondaryColor: string
  logoUrl: string
}

export default function ThemeForm({ locationId, primaryColor: initPrimary, secondaryColor: initSecondary, logoUrl: initLogo }: Props) {
  const [primaryColor, setPrimaryColor] = useState(initPrimary)
  const [secondaryColor, setSecondaryColor] = useState(initSecondary)
  const [logoUrl, setLogoUrl] = useState(initLogo)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setResult(null)
    const res = await saveThemeOverrides(locationId, {
      ...(primaryColor ? { primaryColor } : {}),
      ...(secondaryColor ? { secondaryColor } : {}),
      ...(logoUrl ? { logoUrl } : {}),
    })
    setSaving(false)
    setResult(res?.error ? { error: res.error } : { ok: true })
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <h2 className="text-base font-bold text-gray-800">Personalizzazione Visiva</h2>
      <p className="mt-1 mb-5 text-sm text-gray-500">
        Colori e logo per questa location. Lascia vuoto per usare i valori predefiniti del design.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
              Colore Primario
            </label>
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-10 w-full cursor-pointer rounded-xl border border-gray-200 p-1"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
              Colore Secondario
            </label>
            <input
              type="color"
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className="h-10 w-full cursor-pointer rounded-xl border border-gray-200 p-1"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
            Logo URL
          </label>
          <input
            type="url"
            placeholder="https://..."
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#2A00CC] focus:ring-2 focus:ring-[rgba(42,0,204,0.15)] transition-all"
          />
        </div>

        {result?.error && <p className="text-sm text-red-600">{result.error}</p>}
        {result?.ok && <p className="text-sm text-green-600">Salvato con successo.</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl py-2.5 text-sm font-bold text-black transition-all hover:opacity-90 disabled:opacity-50"
          style={{ background: '#00F0FF' }}
        >
          {saving ? 'Salvataggio...' : 'Salva Personalizzazione'}
        </button>
      </form>
    </div>
  )
}
