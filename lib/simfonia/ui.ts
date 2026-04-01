/**
 * Simfonia CRM — shared Tailwind class strings (visual layer only).
 * Import as: import { sf } from '@/lib/simfonia/ui'
 */
export const sf = {
  eyebrow: 'text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400',

  pageTitle: 'text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl',
  pageSubtitle: 'mt-2 max-w-2xl text-sm leading-relaxed text-gray-600 sm:text-base',

  /** Primary surfaces */
  card: 'rounded-3xl border border-gray-200/70 bg-white/90 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] backdrop-blur-sm',
  cardPadding: 'p-5 sm:p-6',
  cardMuted: 'rounded-3xl border border-gray-200/60 bg-gray-50/90 backdrop-blur-sm',

  /** Stat / dashboard tiles */
  statTile:
    'rounded-3xl border border-gray-200/70 bg-white/95 p-5 shadow-sm backdrop-blur-sm sm:p-6',

  /** Controls */
  primaryBtn:
    'inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-900/10 px-6 py-3 text-sm font-bold text-gray-900 shadow-lg transition hover:brightness-[1.03] active:scale-[0.98]',
  secondaryBtn:
    'inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200/90 bg-white/90 px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm backdrop-blur-sm transition hover:bg-white',

  input:
    'rounded-2xl border border-gray-200/90 bg-white shadow-sm outline-none transition placeholder:text-gray-400 focus:border-brand/40 focus:ring-2 focus:ring-brand/15',

  /** Filter / toolbar panels */
  panel: 'rounded-3xl border border-gray-200/70 bg-white/85 p-4 shadow-sm backdrop-blur-md sm:p-5',

  sectionLabel: 'text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400',

  /** Conversations layout */
  inbox: 'flex flex-1 overflow-hidden rounded-3xl border border-gray-200/70 bg-white/92 shadow-[0_8px_40px_-16px_rgba(15,23,42,0.12)] backdrop-blur-md',

  /** Calendar week view shell */
  calendarWeek:
    'min-w-0 flex-1 overflow-hidden rounded-3xl border border-gray-200/70 bg-white/95 shadow-sm backdrop-blur-sm',

  /** Empty / loading panels */
  emptyPanel: 'rounded-3xl border border-dashed border-gray-200/80 bg-white/60 px-8 py-16 text-center backdrop-blur-sm',

  /** Settings / forms */
  formCard: 'rounded-3xl border border-gray-200/70 bg-white/90 p-5 shadow-sm backdrop-blur-sm sm:p-6',
  formLabel:
    'mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-gray-500',
  formTitle: 'text-lg font-bold tracking-tight text-gray-900',
  formDesc: 'mt-1 text-sm text-gray-500',

  /** Inputs — full width */
  inputFull: `w-full rounded-2xl border border-gray-200/90 bg-white px-4 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-brand/40 focus:ring-2 focus:ring-brand/15`,

  inputSm:
    'rounded-xl border border-gray-200/90 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/15',

  /** Primary actions */
  btnBrand:
    'rounded-2xl bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-110 disabled:opacity-40',

  btnSave:
    'w-full rounded-2xl border border-gray-900/10 py-3 text-sm font-bold text-gray-900 shadow-md transition hover:brightness-[1.02] disabled:opacity-45',

  tableShell: 'overflow-hidden rounded-2xl border border-gray-200/70 bg-white/95',
  tableHeadRow: 'border-b border-gray-200/80 bg-gray-50/90 backdrop-blur-sm',
} as const
