'use client'

import { useState, useEffect } from 'react'
import SimfoniaPageHeader from '../../_components/SimfoniaPageHeader'

interface LocationSettings {
  companyName: string
  defaultMessageType: 'SMS' | 'WhatsApp'
  dripDefaultBatchSize: number
  dripDefaultInterval: number
  dripDefaultUnit: 'minutes' | 'hours' | 'days'
  autoReplyEnabled: boolean
  autoReplyMessage: string
  notifyUnreplied: boolean
  notifyUnrepliedMinutes: number
  notifyCampaignComplete: boolean
  welcomeMessageEnabled: boolean
  welcomeMessage: string
}

const DEFAULT_SETTINGS: LocationSettings = {
  companyName: '',
  defaultMessageType: 'SMS',
  dripDefaultBatchSize: 10,
  dripDefaultInterval: 1,
  dripDefaultUnit: 'hours',
  autoReplyEnabled: false,
  autoReplyMessage: '',
  notifyUnreplied: true,
  notifyUnrepliedMinutes: 30,
  notifyCampaignComplete: true,
  welcomeMessageEnabled: false,
  welcomeMessage: '',
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
        autoReplyEnabled: true,
        autoReplyMessage: 'Grazie per il messaggio! Ti risponderemo al più presto.',
        welcomeMessageEnabled: true,
        welcomeMessage: 'Benvenuto in Apulian Tourism! Come possiamo aiutarti?',
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
    { id: 'general', label: 'General' },
    { id: 'messaging', label: 'Messaging' },
    { id: 'drip', label: 'Drip Feed' },
    { id: 'automation', label: 'Automation' },
    { id: 'notifications', label: 'Notifications' },
  ]

  return (
    <div className="space-y-6">
      <SimfoniaPageHeader eyebrow="Configuration" title="Settings" description="Configure your messaging preferences and automations." />

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
            <Section title="General">
              <Field label="Company Name">
                <input
                  type="text"
                  value={settings.companyName}
                  onChange={(e) => update('companyName', e.target.value)}
                  placeholder="Your company name"
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--shell-line)', backgroundColor: 'var(--shell-canvas)', color: 'var(--foreground)' }}
                />
              </Field>
              <Field label="Default Message Type">
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

          {/* Messaging */}
          {activeSection === 'messaging' && (
            <Section title="Welcome Message">
              <Toggle
                label="Send welcome message to new contacts"
                checked={settings.welcomeMessageEnabled}
                onChange={(v) => update('welcomeMessageEnabled', v)}
              />
              {settings.welcomeMessageEnabled && (
                <Field label="Welcome Message">
                  <textarea
                    value={settings.welcomeMessage}
                    onChange={(e) => update('welcomeMessage', e.target.value)}
                    placeholder="Write your welcome message…"
                    rows={3}
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none resize-none"
                    style={{ borderColor: 'var(--shell-line)', backgroundColor: 'var(--shell-canvas)', color: 'var(--foreground)' }}
                  />
                </Field>
              )}
            </Section>
          )}

          {/* Drip Feed */}
          {activeSection === 'drip' && (
            <Section title="Drip Feed Defaults">
              <p className="text-xs" style={{ color: 'var(--shell-muted)' }}>Set default values for new drip campaigns. These can be overridden per campaign.</p>
              <Field label="Default Batch Size">
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
                <Field label="Default Interval">
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
                  <option value="minutes">minutes</option>
                  <option value="hours">hours</option>
                  <option value="days">days</option>
                </select>
              </div>
            </Section>
          )}

          {/* Automation */}
          {activeSection === 'automation' && (
            <Section title="Auto-Reply">
              <Toggle
                label="Enable auto-reply for incoming messages"
                checked={settings.autoReplyEnabled}
                onChange={(v) => update('autoReplyEnabled', v)}
              />
              {settings.autoReplyEnabled && (
                <Field label="Auto-Reply Message">
                  <textarea
                    value={settings.autoReplyMessage}
                    onChange={(e) => update('autoReplyMessage', e.target.value)}
                    placeholder="Automatic reply message…"
                    rows={3}
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none resize-none"
                    style={{ borderColor: 'var(--shell-line)', backgroundColor: 'var(--shell-canvas)', color: 'var(--foreground)' }}
                  />
                </Field>
              )}
            </Section>
          )}

          {/* Notifications */}
          {activeSection === 'notifications' && (
            <Section title="Notifications">
              <Toggle
                label="Notify when conversations go unreplied"
                checked={settings.notifyUnreplied}
                onChange={(v) => update('notifyUnreplied', v)}
              />
              {settings.notifyUnreplied && (
                <Field label="Alert after (minutes)">
                  <input
                    type="number"
                    value={settings.notifyUnrepliedMinutes}
                    onChange={(e) => update('notifyUnrepliedMinutes', parseInt(e.target.value) || 30)}
                    min="5"
                    className="w-24 rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--shell-line)', backgroundColor: 'var(--shell-canvas)', color: 'var(--foreground)' }}
                  />
                </Field>
              )}
              <Toggle
                label="Notify when campaign completes"
                checked={settings.notifyCampaignComplete}
                onChange={(v) => update('notifyCampaignComplete', v)}
              />
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
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
            {saved && <span className="text-xs font-medium text-emerald-600">Saved!</span>}
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
