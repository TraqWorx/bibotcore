'use client'

import { useState, type ReactNode } from 'react'

export interface TabDef {
  id: string
  label: string
  badge?: string | number
  content: ReactNode
}

export default function SettingsTabs({ tabs, initial }: { tabs: TabDef[]; initial?: string }) {
  const [active, setActive] = useState(initial ?? tabs[0]?.id)
  const current = tabs.find((t) => t.id === active) ?? tabs[0]

  return (
    <div>
      <div
        role="tablist"
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: '1px solid var(--ap-line)',
          marginBottom: 20,
          overflowX: 'auto',
        }}
      >
        {tabs.map((t) => {
          const isActive = t.id === active
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.id)}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '10px 14px',
                fontSize: 13,
                fontWeight: 700,
                color: isActive ? 'var(--ap-primary)' : 'var(--ap-text-muted)',
                borderBottom: isActive ? '2px solid var(--ap-primary)' : '2px solid transparent',
                marginBottom: -1,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {t.label}
              {t.badge != null && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '1px 7px',
                    borderRadius: 999,
                    background: isActive ? 'var(--ap-primary)' : 'var(--ap-bg-muted, #eef2f7)',
                    color: isActive ? '#fff' : 'var(--ap-text-muted)',
                  }}
                >
                  {t.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div role="tabpanel">{current?.content}</div>
    </div>
  )
}
