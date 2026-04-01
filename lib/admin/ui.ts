/**
 * Admin UI — shared Tailwind class strings (visual layer only).
 * Import as: import { ad } from '@/lib/admin/ui'
 */
export const ad = {
  pageTitle: 'text-3xl font-bold tracking-tight text-gray-950',
  pageSubtitle: 'mt-2 max-w-2xl text-sm leading-relaxed text-gray-600',

  panel:
    'rounded-3xl border border-gray-200/70 bg-white/85 p-5 shadow-sm backdrop-blur-md sm:p-6',
  card:
    'rounded-3xl border border-gray-200/70 bg-white/90 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] backdrop-blur-sm',
  cardPadding: 'p-5 sm:p-6',

  sectionLabel: 'text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400',

  input:
    'w-full rounded-2xl border border-gray-200/90 bg-white px-4 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-brand/40 focus:ring-2 focus:ring-brand/15',

  btnPrimary:
    'inline-flex items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-110 disabled:opacity-40',
  btnSecondary:
    'inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200/90 bg-white/90 px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm backdrop-blur-sm transition hover:bg-white',

  tableShell: 'overflow-hidden rounded-2xl border border-gray-200/70 bg-white/95',
  tableHeadRow: 'border-b border-gray-200/80 bg-gray-50/90 backdrop-blur-sm',
} as const

