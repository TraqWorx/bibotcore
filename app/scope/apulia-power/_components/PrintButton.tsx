'use client'

export default function PrintButton() {
  return (
    <div className="sow-actions">
      <button onClick={() => window.print()} className="sow-print">
        🖨 Stampa / Esporta PDF
      </button>
    </div>
  )
}
