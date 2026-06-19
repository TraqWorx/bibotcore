'use client'

export const TONE_HEX: Record<string, string> = {
  gray: '#9aa3a0',
  blue: '#6b8e7f',
  amber: '#c08a2e',
  green: '#4e9e7a',
  red: '#c2554b',
  neutral: '#7f8a85',
}

export interface Slice { label: string; value: number; color?: string }

/** Dependency-free donut (conic-gradient) + legend. */
export default function PieChart({ slices }: { slices: Slice[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  let acc = 0
  const stops = slices.map((s) => {
    const hex = TONE_HEX[s.color ?? 'neutral'] ?? TONE_HEX.neutral
    const start = total > 0 ? (acc / total) * 360 : 0
    acc += s.value
    const end = total > 0 ? (acc / total) * 360 : 0
    return `${hex} ${start}deg ${end}deg`
  })
  const bg = total > 0 ? `conic-gradient(${stops.join(', ')})` : 'var(--fc-line)'

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ width: 160, height: 160, borderRadius: '50%', background: bg, position: 'relative', flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: 28, borderRadius: '50%', background: 'var(--fc-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{total}</div>
          <div style={{ fontSize: 11, color: 'var(--fc-text-muted)' }}>clienti</div>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {slices.map((s) => {
          const hex = TONE_HEX[s.color ?? 'neutral'] ?? TONE_HEX.neutral
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0
          return (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: hex, display: 'inline-block' }} />
              <span style={{ fontWeight: 600 }}>{s.label}</span>
              <span style={{ color: 'var(--fc-text-muted)' }}>{s.value} · {pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
