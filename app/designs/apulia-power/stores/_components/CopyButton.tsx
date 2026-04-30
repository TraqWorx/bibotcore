'use client'

import { useState } from 'react'

export default function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <button onClick={copy} className="ap-btn ap-btn-ghost" style={{ height: 32, padding: '0 12px', fontSize: 11 }}>
      {copied ? '✓ Copiato' : label}
    </button>
  )
}
