'use client'

import type { ReactNode } from 'react'

export type SegmentedItem<T extends string = string> = {
  value: T
  label: ReactNode
  icon?: ReactNode
}

type SegmentedControlProps<T extends string> = {
  items: SegmentedItem<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  listClassName?: string
  ariaLabel?: string
  tablist?: boolean
  tabIdPrefix?: string
  equalWidth?: boolean
  scrollable?: boolean
  size?: 'md' | 'sm'
  stackedIcons?: boolean
}

export default function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  className = '',
  listClassName = '',
  ariaLabel = 'Opzioni',
  tablist = false,
  tabIdPrefix = 'segment',
  equalWidth = true,
  scrollable = false,
  size = 'md',
  stackedIcons = false,
}: SegmentedControlProps<T>) {
  const outer = scrollable
    ? `overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`.trim()
    : className

  const listBase =
    'flex gap-0.5 rounded-2xl border border-gray-200/60 bg-white/55 p-1 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.85)] backdrop-blur-md'

  const layoutWide = stackedIcons
    ? 'relative flex min-h-[2.5rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-2 text-center transition-[color,background,box-shadow,transform] duration-200 sm:flex-row sm:gap-1.5 sm:px-2.5 sm:py-2'
    : 'relative flex min-h-[2.25rem] min-w-0 items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-center font-semibold transition-[color,background,box-shadow] duration-200'

  const layoutSm = stackedIcons
    ? layoutWide
    : 'relative flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 font-semibold transition-[color,background,box-shadow] duration-200'

  const btnLayout = size === 'sm' ? layoutSm : layoutWide
  const textSize = size === 'sm'
    ? stackedIcons
      ? 'text-[10px] sm:text-xs'
      : 'text-xs'
    : stackedIcons
      ? 'text-[10px] font-semibold leading-tight tracking-tight sm:text-[11px]'
      : 'text-xs font-semibold tracking-tight'

  const innerStretch = equalWidth ? 'min-w-full' : 'w-max max-w-full'

  return (
    <div className={outer}>
      <div
        role={tablist ? 'tablist' : undefined}
        aria-label={tablist ? ariaLabel : undefined}
        className={`${listBase} ${innerStretch} ${listClassName}`.trim()}
      >
        {items.map((item) => {
          const selected = value === item.value
          return (
            <button
              key={String(item.value)}
              type="button"
              role={tablist ? 'tab' : undefined}
              aria-selected={tablist ? selected : undefined}
              id={tablist ? `${tabIdPrefix}-${item.value}` : undefined}
              onClick={() => onChange(item.value)}
              className={`${btnLayout} ${equalWidth ? 'flex-1' : 'shrink-0'} ${textSize} ${
                selected
                  ? 'bg-white text-brand shadow-[0_2px_8px_-2px_color-mix(in_srgb,var(--brand)_20%,transparent)] ring-1 ring-brand/20'
                  : 'text-gray-500 hover:bg-white/45 hover:text-gray-800'
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35`}
            >
              {item.icon ? (
                <span
                  className={`shrink-0 [&_svg]:transition-colors ${selected ? 'text-brand' : 'text-gray-400'}`}
                  aria-hidden
                >
                  {item.icon}
                </span>
              ) : null}
              <span
                className={
                  stackedIcons
                    ? 'max-w-[4.5rem] truncate leading-tight sm:max-w-none'
                    : 'whitespace-nowrap'
                }
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
