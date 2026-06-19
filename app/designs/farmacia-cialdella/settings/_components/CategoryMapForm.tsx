'use client'

import { useState, useTransition } from 'react'
import { addCategoryMapping } from '../_actions'

export default function CategoryMapForm() {
  const [pending, start] = useTransition()
  const [err, setErr] = useState('')

  return (
    <form
      action={(fd) => start(async () => {
        setErr('')
        const res = await addCategoryMapping(fd)
        if (res?.error) setErr(res.error)
      })}
      style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}
    >
      <input name="sku" placeholder="SKU" style={inp} />
      <input name="ean" placeholder="EAN" style={inp} />
      <input name="category" placeholder="Categoria" style={inp} required />
      <button className="fc-btn-primary" disabled={pending}>{pending ? '…' : 'Aggiungi'}</button>
      {err && <span style={{ color: 'var(--fc-danger)', fontSize: 13 }}>{err}</span>}
    </form>
  )
}

const inp: React.CSSProperties = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--fc-line-strong)', fontSize: 14 }
