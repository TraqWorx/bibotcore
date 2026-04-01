'use client'

import { useState } from 'react'
import { sf } from '@/lib/simfonia/ui'

interface Props {
  locationId: string
  portalUrl: string
  initialIconUrl: string
  initialWelcomeMessage: string
  initialAutoInvite: boolean
}

export default function PortalSettingsForm({ locationId, portalUrl, initialIconUrl, initialWelcomeMessage, initialAutoInvite }: Props) {
  const [iconUrl, setIconUrl] = useState(initialIconUrl)
  const [welcomeMessage, setWelcomeMessage] = useState(initialWelcomeMessage)
  const [autoInvite, setAutoInvite] = useState(initialAutoInvite)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    const res = await fetch('/api/portal/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId, iconUrl, welcomeMessage, autoInvite }),
    })
    if (res.ok) {
      setMessage('Salvato')
    } else {
      setMessage('Errore nel salvataggio')
    }
    setSaving(false)
    setTimeout(() => setMessage(null), 2000)
  }

  function copyUrl() {
    navigator.clipboard.writeText(portalUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Portal URL */}
      <div>
        <h3 className="text-sm font-bold text-gray-800">URL Portale Clienti</h3>
        <p className="mt-1 text-xs text-gray-400">Condividi questo link con i tuoi clienti per accedere al portale.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            readOnly
            value={portalUrl}
            className={`${sf.inputFull} flex-1 bg-gray-50/90 font-mono text-gray-600`}
          />
          <button
            type="button"
            onClick={copyUrl}
            className={`${sf.secondaryBtn} shrink-0`}
          >
            {copied ? 'Copiato!' : 'Copia'}
          </button>
        </div>
      </div>

      {/* Portal Icon */}
      <div>
        <h3 className="text-sm font-bold text-gray-800">Icona App (PWA)</h3>
        <p className="mt-1 text-xs text-gray-400">
          Quando i clienti aggiungono il portale alla schermata del telefono, questa icona viene usata. Consigliato: 512x512 PNG.
        </p>
        <div className="mt-3 flex items-center gap-4">
          {iconUrl && (
            <img
              src={iconUrl}
              alt="Portal icon"
              className="h-16 w-16 rounded-2xl border border-gray-200/80 object-cover shadow-sm"
            />
          )}
          <input
            type="url"
            value={iconUrl}
            onChange={(e) => setIconUrl(e.target.value)}
            placeholder="https://example.com/icon-512.png"
            className={`${sf.inputFull} flex-1`}
          />
        </div>
      </div>

      {/* Welcome Message */}
      <div>
        <h3 className="text-sm font-bold text-gray-800">Messaggio di Benvenuto</h3>
        <p className="mt-1 text-xs text-gray-400">Inviato via email quando un nuovo contatto viene invitato al portale.</p>
        <textarea
          value={welcomeMessage}
          onChange={(e) => setWelcomeMessage(e.target.value)}
          rows={3}
          className={`${sf.inputFull} mt-3 min-h-[5.5rem]`}
        />
      </div>

      {/* Auto-invite */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200/70 bg-white/90 px-4 py-3 backdrop-blur-sm">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Invito Automatico</h3>
          <p className="text-xs text-gray-400">Invia automaticamente il link del portale ai nuovi contatti con email.</p>
        </div>
        <button
          type="button"
          onClick={() => setAutoInvite(!autoInvite)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent ${
            autoInvite ? 'bg-emerald-500' : 'bg-gray-200'
          }`}
        >
          <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ${
            autoInvite ? 'translate-x-5' : 'translate-x-0'
          }`} />
        </button>
      </div>

      {/* Save */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={sf.btnBrand}
        >
          {saving ? 'Salvataggio…' : 'Salva'}
        </button>
        {message && <span className="text-xs font-medium text-green-600">{message}</span>}
      </div>
    </div>
  )
}
