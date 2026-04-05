import type { ReactNode } from 'react'
import { sf } from '@/lib/simfonia/ui'

export default function SimfoniaPageHeader({
  eyebrow,
  title,
  description,
  actions,
  className = '',
}: {
  eyebrow?: string
  title: string
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div
      className={`sf-page-header flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between ${className}`.trim()}
    >
      <div className="min-w-0">
        {eyebrow ? <p className={sf.eyebrow}>{eyebrow}</p> : null}
        <h1 className={eyebrow ? `mt-2 ${sf.pageTitle}` : sf.pageTitle}>{title}</h1>
        {description ? <div className={sf.pageSubtitle}>{description}</div> : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>
      ) : null}
    </div>
  )
}
