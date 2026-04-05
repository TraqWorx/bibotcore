'use client'

import { useState } from 'react'
import { saveThemeOverrides } from '../_actions'
import { sf } from '@/lib/simfonia/ui'

interface Props {
  locationId: string
  primaryColor: string
  secondaryColor: string
  logoUrl: string
  demoMode?: boolean
}

export default function ThemeForm({ locationId, primaryColor: initPrimary, secondaryColor: initSecondary, logoUrl: initLogo, demoMode = false }: Props) {
  const [primaryColor, setPrimaryColor] = useState(initPrimary)
  const [secondaryColor, setSecondaryColor] = useState(initSecondary)
  const [logoUrl, setLogoUrl] = useState(initLogo)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (demoMode) {
      setResult({ ok: true })
      return
    }
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
    <div className={sf.formCard}>
      <h2 className={sf.formTitle}>Personalizzazione visiva</h2>
      <p className={`${sf.formDesc} mb-5`}>
        Colori e logo per questa location. Il logo viene usato nella sidebar Simfonia e i colori guidano tutto il tema.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={sf.formLabel}>Colore primario</label>
            <input
              type="color"
              value={primaryColor}
          onChange={(e) => setPrimaryColor(e.target.value)}
          disabled={demoMode}
          className="h-12 w-full cursor-pointer rounded-2xl border border-gray-200/90 bg-white p-1 shadow-sm"
            />
          </div>
          <div>
            <label className={sf.formLabel}>Colore secondario</label>
            <input
              type="color"
              value={secondaryColor}
          onChange={(e) => setSecondaryColor(e.target.value)}
          disabled={demoMode}
          className="h-12 w-full cursor-pointer rounded-2xl border border-gray-200/90 bg-white p-1 shadow-sm"
            />
          </div>
        </div>

        <div>
          <label className={sf.formLabel}>Logo URL</label>
          <input
            type="url"
            placeholder="https://..."
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            disabled={demoMode}
            className={sf.inputFull}
          />
        </div>

        {result?.error && <p className="text-sm font-medium text-red-600">{result.error}</p>}
        {result?.ok && <p className="text-sm font-medium text-emerald-600">Salvato con successo.</p>}

        <button
          type="submit"
          disabled={saving}
          className={`${sf.btnSave} font-bold`}
        >
          {saving ? 'Salvataggio…' : 'Salva personalizzazione'}
        </button>
      </form>
    </div>
  )
}
