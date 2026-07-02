'use client'

import { useState, useEffect } from 'react'
import { BELLESSERE_BOOKING_LINK } from '@/lib/bellessere/constants'

const QR_URL = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=10&data=${encodeURIComponent(BELLESSERE_BOOKING_LINK)}`

export default function ImpostazioniPage() {
  const [reminderTemplate, setReminderTemplate] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('bellessere_reminder_template') ?? ''
    return ''
  })
  const [reminderSaved, setReminderSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  function copyLink() {
    navigator.clipboard?.writeText(BELLESSERE_BOOKING_LINK).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1600)
    }).catch(() => {})
  }

  function printQr() {
    const w = window.open('', '_blank', 'width=620,height=860')
    if (!w) return
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Prenota da Bellessere</title></head>
      <body style="margin:0;text-align:center;font-family:-apple-system,'Segoe UI',sans-serif;color:#121417;padding:48px 32px">
        <img src="https://ghlcustomdash.com/bellessere-logo.png" width="130" height="130" style="border-radius:18px;object-fit:contain"/>
        <h1 style="font-size:30px;margin:26px 0 6px;letter-spacing:-.5px">Prenota il tuo appuntamento</h1>
        <p style="font-size:16px;color:#5F6876;margin:0 0 28px">Inquadra il QR code con la fotocamera del telefono</p>
        <img src="${QR_URL}" width="340" height="340" alt="QR"/>
        <p style="font-size:12px;color:#8C96A6;word-break:break-all;margin-top:24px">${BELLESSERE_BOOKING_LINK}</p>
      </body></html>`)
    w.document.close()
    setTimeout(() => { w.focus(); w.print() }, 600)
  }

  const [inviteText, setInviteText] = useState('')
  const [inviteSaved, setInviteSaved] = useState(false)

  useEffect(() => {
    fetch('/api/bellessere/settings').then(r => r.json()).then(d => setInviteText(d.inviteText ?? '')).catch(() => {})
  }, [])

  function saveReminderTemplate() {
    localStorage.setItem('bellessere_reminder_template', reminderTemplate)
    setReminderSaved(true)
    setTimeout(() => setReminderSaved(false), 2000)
  }

  async function saveInviteText() {
    await fetch('/api/bellessere/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inviteText }) }).catch(() => {})
    setInviteSaved(true)
    setTimeout(() => setInviteSaved(false), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <h1 className="bs-page-title">Impostazioni</h1>
      </div>

      {/* Booking link + QR to print */}
      <div className="bs-card" style={{ padding: '22px 24px', display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Link prenotazioni</div>
          <div style={{ fontSize: 13, color: 'var(--bs-text-muted)', marginBottom: 14, lineHeight: 1.55 }}>
            Condividi questo link con i clienti per prenotare online, oppure stampa il QR code e mettilo in salone.
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input readOnly value={BELLESSERE_BOOKING_LINK} onFocus={e => e.currentTarget.select()}
              className="bs-input" style={{ flex: 1, minWidth: 200, fontSize: 12.5, color: 'var(--bs-text-muted)' }} />
            <button className="bs-btn-ghost" onClick={copyLink} style={{ fontSize: 12.5 }}>{copied ? 'Copiato ✓' : 'Copia'}</button>
            <a className="bs-btn-ghost" href={BELLESSERE_BOOKING_LINK} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, textDecoration: 'none' }}>Apri</a>
          </div>
          <button className="bs-btn-primary" onClick={printQr} style={{ marginTop: 14 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
            </svg>
            Stampa QR code
          </button>
        </div>
        <div style={{ textAlign: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={QR_URL} alt="QR prenotazioni" width={150} height={150} style={{ border: '1px solid var(--bs-line)', borderRadius: 12, padding: 8, background: '#fff' }} />
          <div style={{ fontSize: 11, color: 'var(--bs-text-faint)', marginTop: 6 }}>Anteprima QR</div>
        </div>
      </div>

      {/* Reminder template */}
      <div className="bs-card" style={{ padding: '22px 24px' }}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Testo del reminder</div>
        <div style={{ fontSize: 13, color: 'var(--bs-text-muted)', marginBottom: 14 }}>
          Testo predefinito per i reminder SMS. Usa <code style={{ background: 'var(--bs-bg)', padding: '1px 5px', borderRadius: 4 }}>{'{{nome}}'}</code>, <code style={{ background: 'var(--bs-bg)', padding: '1px 5px', borderRadius: 4 }}>{'{{servizio}}'}</code>, <code style={{ background: 'var(--bs-bg)', padding: '1px 5px', borderRadius: 4 }}>{'{{data}}'}</code>, <code style={{ background: 'var(--bs-bg)', padding: '1px 5px', borderRadius: 4 }}>{'{{ora}}'}</code> come segnaposto.
        </div>
        <textarea
          className="bs-input"
          rows={4}
          style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13.5 }}
          placeholder={`Ciao {{nome}}, ti ricordiamo il tuo appuntamento per {{servizio}} il {{data}} alle {{ora}}. Per info chiama il salone. Grazie!`}
          value={reminderTemplate}
          onChange={e => setReminderTemplate(e.target.value)}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <button className="bs-btn-primary" onClick={saveReminderTemplate}>
            {reminderSaved ? 'Salvato ✓' : 'Salva'}
          </button>
          {reminderTemplate && (
            <button className="bs-btn-ghost" onClick={() => { setReminderTemplate(''); localStorage.removeItem('bellessere_reminder_template') }} style={{ fontSize: 12.5 }}>
              Ripristina default
            </button>
          )}
        </div>
      </div>

      {/* Waiting-list invite text */}
      <div className="bs-card" style={{ padding: '22px 24px' }}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Testo invito lista d&apos;attesa</div>
        <div style={{ fontSize: 13, color: 'var(--bs-text-muted)', marginBottom: 14 }}>
          Messaggio SMS inviato quando si libera un posto. Usa <code style={{ background: 'var(--bs-bg)', padding: '1px 5px', borderRadius: 4 }}>{'{{nome}}'}</code>, <code style={{ background: 'var(--bs-bg)', padding: '1px 5px', borderRadius: 4 }}>{'{{servizio}}'}</code>, <code style={{ background: 'var(--bs-bg)', padding: '1px 5px', borderRadius: 4 }}>{'{{giorno}}'}</code>, <code style={{ background: 'var(--bs-bg)', padding: '1px 5px', borderRadius: 4 }}>{'{{ora}}'}</code>, <code style={{ background: 'var(--bs-bg)', padding: '1px 5px', borderRadius: 4 }}>{'{{link}}'}</code> come segnaposto.
        </div>
        <textarea
          className="bs-input"
          rows={4}
          style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13.5 }}
          placeholder={`Ciao {{nome}}! Si è liberato un posto per {{servizio}} il {{giorno}} alle {{ora}} da Bellessere. Prenota subito qui: {{link}}`}
          value={inviteText}
          onChange={e => setInviteText(e.target.value)}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <button className="bs-btn-primary" onClick={saveInviteText}>
            {inviteSaved ? 'Salvato ✓' : 'Salva'}
          </button>
          {inviteText && (
            <button className="bs-btn-ghost" onClick={() => { setInviteText(''); saveInviteText() }} style={{ fontSize: 12.5 }}>
              Ripristina default
            </button>
          )}
        </div>
      </div>

      {/* Stripe */}
      <div className="bs-card" style={{ padding: '22px 24px', display: 'flex', alignItems: 'flex-start', gap: 20 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: '#635BFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>Pagamenti Stripe</div>
          <div style={{ fontSize: 13, color: 'var(--bs-text-muted)', lineHeight: 1.65, marginBottom: 16 }}>
            Per accettare pagamenti online e gestire le transazioni, collega il tuo account Stripe direttamente da GoHighLevel.<br />
            Vai su <strong>GHL → Impostazioni → Pagamenti → Integrazioni</strong> e clicca <strong>Connect with Stripe</strong>. Una volta collegato, i pagamenti per gli appuntamenti vengono gestiti automaticamente.
          </div>
          <a
            href="https://app.gohighlevel.com/settings/payments/integrations"
            target="_blank"
            rel="noopener noreferrer"
            className="bs-btn-primary"
            style={{ display: 'inline-flex', textDecoration: 'none', background: '#635BFF' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Apri impostazioni pagamenti in GHL
          </a>
        </div>
      </div>
    </div>
  )
}
