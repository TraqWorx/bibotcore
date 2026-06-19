'use client'

import { useState, useTransition } from 'react'
import { deleteTagEverywhere } from '../_actions'

export default function TagManager({ tags }: { tags: { tag: string; count: number }[] }) {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState('')

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--fc-text-muted)', marginBottom: 12 }}>
        Etichette in uso sui clienti. I tag di canale (amazon/ebay/store) e fascia (livello-*) guidano le automazioni su GHL.
      </p>
      <div className="fc-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="fc-table" style={{ width: '100%' }}>
          <thead><tr><th>Tag</th><th>Clienti</th><th></th></tr></thead>
          <tbody>
            {tags.length === 0 && <tr><td colSpan={3} style={{ padding: 16, color: 'var(--fc-text-muted)' }}>Nessun tag.</td></tr>}
            {tags.map((t) => (
              <tr key={t.tag}>
                <td><span className="fc-pill" data-tone="gray">{t.tag}</span></td>
                <td>{t.count}</td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    onClick={() => { if (confirm(`Rimuovere "${t.tag}" da tutti i ${t.count} clienti (anche su GHL)?`)) start(async () => { const r = await deleteTagEverywhere(t.tag); setMsg(`Rimosso da ${r.removed ?? 0} clienti.`) }) }}
                    disabled={pending}
                    style={{ background: 'none', border: 'none', color: 'var(--fc-danger)', cursor: 'pointer', fontSize: 13 }}
                  >Rimuovi da tutti</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {msg && <p style={{ fontSize: 13, color: 'var(--fc-text-muted)', marginTop: 8 }}>{msg}</p>}
    </div>
  )
}
