'use client'

import type { ReactNode } from 'react'

interface Props {
  title?: string
  children: ReactNode
  className?: string
}

export default function WidgetShell({ title, children, className = '' }: Props) {
  return (
    <div className={`overflow-hidden rounded-[28px] border border-[var(--shell-line)] bg-[var(--shell-surface)] shadow-[0_18px_40px_-32px_rgba(23,21,18,0.22)] ${className}`}>
      {title && (
        <div className="px-5 pt-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--shell-muted)]">{title}</p>
        </div>
      )}
      {children}
    </div>
  )
}
