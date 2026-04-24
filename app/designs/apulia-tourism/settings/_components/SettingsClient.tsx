'use client'

import { useState, useEffect } from 'react'
import SimfoniaPageHeader from '../../_components/SimfoniaPageHeader'

interface LocationSettings {
  companyName: string
  defaultMessageType: 'SMS' | 'WhatsApp'
  dripDefaultBatchSize: number
  dripDefaultInterval: number
  dripDefaultUnit: 'minutes' | 'hours' | 'days'
}

const DEFAULT_SETTINGS: LocationSettings = {
  companyName: '',
  defaultMessageType: 'SMS',
  dripDefaultBatchSize: 10,
  dripDefaultInterval: 1,
  dripDefaultUnit: 'hours',
}

export default function SettingsClient({ locationId, demoMode = false }: { locationId: string; demoMode?: boolean }) {
  const [settings, setSettings] = useState<LocationSettings>(DEFAULT_SETTINGS)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeSection, setActiveSection] = useState<string>('general')

  // Load settings from localStorage (or API in future)
  useEffect(() => {
    if (demoMode) {
      setSettings({
        ...DEFAULT_SETTINGS,
        companyName: 'Apulian Tourism',
      })
      return
    }
    const saved = localStorage.getItem(`at-settings-${locationId}`)
    if (saved) {
      try { setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) }) } catch { /* ignore */ }
    }
  }, [locationId, demoMode])

  function handleSave() {
    if (demoMode) { setSaved(true); setTimeout(() => setSaved(false), 2000); return }
    setSaving(true)
    localStorage.setItem(`at-settings-${locationId}`, JSON.stringify(settings))
    setTimeout(() => { setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000) }, 300)
  }

  function update<K extends keyof LocationSettings>(key: K, value: LocationSettings[K]) {
    setSettings((s) => ({ ...s, [key]: value }))
  }

  const sections = [
    { id: 'general', label: 'Generale' },
    { id: 'drip', label: 'Invio Graduale' },
  ]

  return (
    <div className="space-y-6">
      <SimfoniaPageHeader eyebrow="Configurazione" title="Impostazioni" description="Configura le preferenze di messaggistica e automazioni." />

      <div className="flex gap-6">
        {/* Sidebar nav */}
        <div className="hidden w-48 shrink-0 lg:block">
          <nav className="space-y-0.5">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className="block w-full rounded-xl px-3 py-2 text-left text-xs font-semibold transition"
                style={activeSection === s.id
                  ? { backgroundColor: 'color-mix(in srgb, var(--brand) 10%, transparent)', color: 'var(--brand)' }
                  : { color: 'var(--shell-muted)' }
                }
              >
                {s.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 space-y-5">
          {/* Mobile section picker */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className="shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold transition"
                style={activeSection === s.id
                  ? { borderColor: 'var(--brand)', backgroundColor: 'color-mix(in srgb, var(--brand) 10%, transparent)', color: 'var(--brand)' }
                  : { borderColor: 'var(--shell-line)', color: 'var(--shell-muted)' }
                }
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* General */}
          {activeSection === 'general' && (
            <Section title="Generale">
              <Field label="Nome Azienda">
                <input
                  type="text"
                  value={settings.companyName}
                  onChange={(e) => update('companyName', e.target.value)}
                  placeholder="Nome della tua azienda"
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--shell-line)', backgroundColor: 'var(--shell-canvas)', color: 'var(--foreground)' }}
                />
              </Field>
              <Field label="Tipo Messaggio Predefinito">
                <div className="flex gap-2">
                  {(['SMS', 'WhatsApp'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => update('defaultMessageType', t)}
                      className="flex-1 rounded-xl border py-2 text-xs font-semibold transition"
                      style={settings.defaultMessageType === t
                        ? { borderColor: 'var(--brand)', backgroundColor: 'color-mix(in srgb, var(--brand) 10%, transparent)', color: 'var(--brand)' }
                        : { borderColor: 'var(--shell-line)', color: 'var(--shell-muted)' }
                      }
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </Field>
            </Section>
          )}

          {/* Drip Feed */}
          {activeSection === 'drip' && (
            <Section title="Impostazioni Invio Graduale">
              <p className="text-xs" style={{ color: 'var(--shell-muted)' }}>Imposta i valori predefiniti per le nuove campagne. Possono essere modificati per ogni campagna.</p>
              <Field label="Dimensione Batch Predefinita">
                <input
                  type="number"
                  value={settings.dripDefaultBatchSize}
                  onChange={(e) => update('dripDefaultBatchSize', parseInt(e.target.value) || 10)}
                  min="1"
                  className="w-24 rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--shell-line)', backgroundColor: 'var(--shell-canvas)', color: 'var(--foreground)' }}
                />
              </Field>
              <div className="flex items-end gap-2">
                <Field label="Intervallo Predefinito">
                  <input
                    type="number"
                    value={settings.dripDefaultInterval}
                    onChange={(e) => update('dripDefaultInterval', parseInt(e.target.value) || 1)}
                    min="1"
                    className="w-24 rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--shell-line)', backgroundColor: 'var(--shell-canvas)', color: 'var(--foreground)' }}
                  />
                </Field>
                <select
                  value={settings.dripDefaultUnit}
                  onChange={(e) => update('dripDefaultUnit', e.target.value as 'minutes' | 'hours' | 'days')}
                  className="rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--shell-line)', backgroundColor: 'var(--shell-canvas)', color: 'var(--foreground)' }}
                >
                  <option value="minutes">minuti</option>
                  <option value="hours">ore</option>
                  <option value="days">giorni</option>
                </select>
              </div>
            </Section>
          )}

          {/* Save button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--brand)' }}
            >
              {saving ? 'Salvataggio…' : 'Salva Impostazioni'}
            </button>
            {saved && <span className="text-xs font-medium text-emerald-600">Salvato!</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Sub-components ── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-5 space-y-4" style={{ borderColor: 'var(--shell-line)', backgroundColor: 'var(--shell-surface)' }}>
      <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--shell-muted)' }}>{label}</label>
      {children}
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1">
      <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="relative h-5 w-9 shrink-0 rounded-full transition-colors"
        style={{ backgroundColor: checked ? 'var(--brand)' : 'var(--shell-soft)' }}
      >
        <span
          className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
          style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }}
        />
      </button>
    </label>
  )
}
