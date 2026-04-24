'use client'

import { useState, useEffect } from 'react'
import SimfoniaPageHeader from '../../_components/SimfoniaPageHeader'

interface MsgTemplate {
  id: string
  name: string
  body: string
  source?: 'ghl' | 'local'
}

interface LocationSettings {
  companyName: string
  defaultMessageType: 'SMS' | 'WhatsApp'
  dripDefaultBatchSize: number
  dripDefaultInterval: number
  dripDefaultUnit: 'minutes' | 'hours' | 'days'
  waTemplates: MsgTemplate[]
  smsSnippets: MsgTemplate[]
}

const DEFAULT_SETTINGS: LocationSettings = {
  companyName: '',
  defaultMessageType: 'SMS',
  dripDefaultBatchSize: 10,
  dripDefaultInterval: 1,
  dripDefaultUnit: 'hours',
  waTemplates: [],
  smsSnippets: [],
}

export default function SettingsClient({ locationId, demoMode = false }: { locationId: string; demoMode?: boolean }) {
  const [settings, setSettings] = useState<LocationSettings>(DEFAULT_SETTINGS)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeSection, setActiveSection] = useState<string>('general')

  // WA template form
  const [waName, setWaName] = useState('')
  const [waBody, setWaBody] = useState('')
  const [editingWaId, setEditingWaId] = useState<string | null>(null)

  // SMS snippet form
  const [smsName, setSmsName] = useState('')
  const [smsBody, setSmsBody] = useState('')
  const [editingSmsId, setEditingSmsId] = useState<string | null>(null)
  const [ghlSnippets, setGhlSnippets] = useState<MsgTemplate[]>([])
  const [ghlLoading, setGhlLoading] = useState(false)

  useEffect(() => {
    if (demoMode) {
      setSettings({
        ...DEFAULT_SETTINGS,
        companyName: 'Apulian Tourism',
        waTemplates: [
          { id: 'demo-1', name: 'gita_di_un_giorno', body: '🌸 Cara amica, Azzurra è lieta di invitarti alla prossima gita organizzata per te 🌸\n\nTrascorreremo insieme ore di spensieratezza e divertimento con balli e tanto altro 💃🕺' },
        ],
      })
      return
    }
    const s = localStorage.getItem(`at-settings-${locationId}`)
    if (s) {
      try { setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(s) }) } catch { /* ignore */ }
    }
    // Fetch GHL SMS snippets
    if (!demoMode) {
      setGhlLoading(true)
      fetch(`/api/ghl/templates?locationId=${locationId}&type=sms`)
        .then((r) => r.json())
        .then((data) => {
          setGhlSnippets((data.templates ?? []).map((t: { id: string; name: string; body?: string }) => ({
            id: t.id, name: t.name, body: t.body ?? '', source: 'ghl' as const,
          })))
        })
        .catch(() => {})
        .finally(() => setGhlLoading(false))
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

  function addWaTemplate() {
    if (!waName.trim() || !waBody.trim()) return
    if (editingWaId) {
      update('waTemplates', settings.waTemplates.map((t) =>
        t.id === editingWaId ? { ...t, name: waName.trim(), body: waBody.trim() } : t
      ))
    } else {
      update('waTemplates', [...settings.waTemplates, { id: Date.now().toString(), name: waName.trim(), body: waBody.trim() }])
    }
    setWaName('')
    setWaBody('')
    setEditingWaId(null)
  }

  function editWaTemplate(t: MsgTemplate) {
    setWaName(t.name)
    setWaBody(t.body)
    setEditingWaId(t.id)
  }

  function deleteWaTemplate(id: string) {
    update('waTemplates', settings.waTemplates.filter((t) => t.id !== id))
    if (editingWaId === id) { setWaName(''); setWaBody(''); setEditingWaId(null) }
  }

  function addSmsSnippet() {
    if (!smsName.trim() || !smsBody.trim()) return
    if (editingSmsId) {
      update('smsSnippets', settings.smsSnippets.map((t) =>
        t.id === editingSmsId ? { ...t, name: smsName.trim(), body: smsBody.trim() } : t
      ))
    } else {
      update('smsSnippets', [...settings.smsSnippets, { id: Date.now().toString(), name: smsName.trim(), body: smsBody.trim(), source: 'local' as const }])
    }
    setSmsName(''); setSmsBody(''); setEditingSmsId(null)
  }

  function editSmsSnippet(t: MsgTemplate) { setSmsName(t.name); setSmsBody(t.body); setEditingSmsId(t.id) }
  function deleteSmsSnippet(id: string) {
    update('smsSnippets', settings.smsSnippets.filter((t) => t.id !== id))
    if (editingSmsId === id) { setSmsName(''); setSmsBody(''); setEditingSmsId(null) }
  }

  const sections = [
    { id: 'general', label: 'Generale' },
    { id: 'sms', label: 'Snippet SMS' },
    { id: 'whatsapp', label: 'Template WhatsApp' },
    { id: 'drip', label: 'Invio Graduale' },
  ]

  return (
    <div className="space-y-6">
      <SimfoniaPageHeader eyebrow="Configurazione" title="Impostazioni" description="Configura le preferenze di messaggistica e i template." />

      <div className="flex gap-6">
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

        <div className="min-w-0 flex-1 space-y-5">
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

          {/* SMS Snippets */}
          {activeSection === 'sms' && (
            <Section title="Snippet SMS">
              <p className="text-xs" style={{ color: 'var(--shell-muted)' }}>
                Snippet SMS caricati da GHL e snippet personalizzati. Quando invii SMS, potrai scegliere tra tutti questi snippet.
              </p>

              {/* GHL snippets (read-only) */}
              {ghlLoading ? (
                <p className="text-xs" style={{ color: 'var(--shell-muted)' }}>Caricamento snippet GHL…</p>
              ) : ghlSnippets.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--shell-muted)' }}>Da GHL</p>
                  {ghlSnippets.map((t) => (
                    <div key={t.id} className="rounded-xl border p-3" style={{ borderColor: 'var(--shell-line)' }}>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>{t.name}</p>
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-medium text-gray-400">GHL</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed line-clamp-3" style={{ color: 'var(--shell-muted)' }}>{t.body}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs" style={{ color: 'var(--shell-muted)' }}>Nessun snippet trovato in GHL.</p>
              )}

              {/* Local snippets */}
              {settings.smsSnippets.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--shell-muted)' }}>Personalizzati</p>
                  {settings.smsSnippets.map((t) => (
                    <div key={t.id} className="rounded-xl border p-3" style={{ borderColor: 'var(--shell-line)' }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>{t.name}</p>
                          <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed" style={{ color: 'var(--shell-muted)' }}>{t.body}</p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button onClick={() => editSmsSnippet(t)} className="rounded-lg p-1 text-gray-400 hover:text-blue-500">
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
                          </button>
                          <button onClick={() => deleteSmsSnippet(t.id)} className="rounded-lg p-1 text-gray-400 hover:text-red-500">
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add snippet form */}
              <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: 'var(--brand)', backgroundColor: 'color-mix(in srgb, var(--brand) 3%, transparent)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--brand)' }}>
                  {editingSmsId ? 'Modifica Snippet' : 'Aggiungi Snippet'}
                </p>
                <input
                  type="text"
                  value={smsName}
                  onChange={(e) => setSmsName(e.target.value)}
                  placeholder="Nome snippet"
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--shell-line)', backgroundColor: 'var(--shell-canvas)', color: 'var(--foreground)' }}
                />
                <textarea
                  value={smsBody}
                  onChange={(e) => setSmsBody(e.target.value)}
                  placeholder="Testo dello snippet..."
                  rows={3}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none resize-none"
                  style={{ borderColor: 'var(--shell-line)', backgroundColor: 'var(--shell-canvas)', color: 'var(--foreground)' }}
                />
                <div className="flex gap-2">
                  <button onClick={addSmsSnippet} disabled={!smsName.trim() || !smsBody.trim()} className="rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-40" style={{ backgroundColor: 'var(--brand)' }}>
                    {editingSmsId ? 'Aggiorna' : 'Aggiungi'}
                  </button>
                  {editingSmsId && (
                    <button onClick={() => { setSmsName(''); setSmsBody(''); setEditingSmsId(null) }} className="text-xs" style={{ color: 'var(--shell-muted)' }}>Annulla</button>
                  )}
                </div>
              </div>
            </Section>
          )}

          {/* WhatsApp Templates */}
          {activeSection === 'whatsapp' && (
            <Section title="Template WhatsApp Approvati">
              <p className="text-xs" style={{ color: 'var(--shell-muted)' }}>
                Registra qui i template approvati da Meta. Quando invii messaggi WhatsApp, potrai scegliere solo tra questi template.
                Copia nome e testo dalla pagina WhatsApp di GHL.
              </p>

              {/* Existing templates */}
              {settings.waTemplates.length > 0 && (
                <div className="space-y-2">
                  {settings.waTemplates.map((t) => (
                    <div key={t.id} className="rounded-xl border p-3" style={{ borderColor: 'var(--shell-line)' }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>{t.name}</p>
                          <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed" style={{ color: 'var(--shell-muted)' }}>{t.body}</p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button onClick={() => editWaTemplate(t)} className="rounded-lg p-1 text-gray-400 hover:text-blue-500">
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
                          </button>
                          <button onClick={() => deleteWaTemplate(t.id)} className="rounded-lg p-1 text-gray-400 hover:text-red-500">
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add/Edit form */}
              <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: 'var(--brand)', backgroundColor: 'color-mix(in srgb, var(--brand) 3%, transparent)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--brand)' }}>
                  {editingWaId ? 'Modifica Template' : 'Aggiungi Template'}
                </p>
                <input
                  type="text"
                  value={waName}
                  onChange={(e) => setWaName(e.target.value)}
                  placeholder="Nome template (es. gita_di_un_giorno)"
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--shell-line)', backgroundColor: 'var(--shell-canvas)', color: 'var(--foreground)' }}
                />
                <textarea
                  value={waBody}
                  onChange={(e) => setWaBody(e.target.value)}
                  placeholder="Incolla qui il testo del template approvato da Meta..."
                  rows={4}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none resize-none"
                  style={{ borderColor: 'var(--shell-line)', backgroundColor: 'var(--shell-canvas)', color: 'var(--foreground)' }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={addWaTemplate}
                    disabled={!waName.trim() || !waBody.trim()}
                    className="rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
                    style={{ backgroundColor: 'var(--brand)' }}
                  >
                    {editingWaId ? 'Aggiorna' : 'Aggiungi'}
                  </button>
                  {editingWaId && (
                    <button onClick={() => { setWaName(''); setWaBody(''); setEditingWaId(null) }} className="text-xs" style={{ color: 'var(--shell-muted)' }}>
                      Annulla
                    </button>
                  )}
                </div>
              </div>
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
