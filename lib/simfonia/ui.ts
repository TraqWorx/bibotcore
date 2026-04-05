/**
 * Simfonia CRM — shared Tailwind class strings (visual layer only).
 * Import as: import { sf } from '@/lib/simfonia/ui'
 */
export const sf = {
  eyebrow: 'sf-eyebrow text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--shell-muted)]',

  pageTitle: 'sf-page-title text-3xl font-black tracking-[-0.05em] text-[var(--foreground)] sm:text-4xl',
  pageSubtitle: 'sf-page-subtitle mt-2 max-w-2xl text-sm leading-relaxed text-[var(--shell-muted)] sm:text-base',

  /** Primary surfaces */
  card: 'sf-card rounded-[28px] border border-[var(--shell-line)] bg-[var(--shell-surface)] shadow-[0_18px_40px_-32px_rgba(23,21,18,0.22)]',
  cardPadding: 'p-5 sm:p-6',
  cardMuted: 'sf-card-muted rounded-[28px] border border-[var(--shell-line)] bg-[var(--shell-canvas)]',

  /** Stat / dashboard tiles */
  statTile:
    'sf-stat-tile rounded-[28px] border border-[var(--shell-line)] bg-[var(--shell-surface)] p-5 shadow-[0_14px_32px_-28px_rgba(23,21,18,0.22)] sm:p-6',

  /** Controls */
  primaryBtn:
    'sf-primary-btn inline-flex items-center justify-center gap-2 rounded-[18px] border border-[color:var(--brand)] bg-[var(--brand)] px-6 py-3 text-sm font-bold text-white shadow-[0_18px_32px_-22px_color-mix(in_srgb,var(--brand)_38%,transparent)] transition hover:brightness-[1.03] active:scale-[0.98]',
  secondaryBtn:
    'sf-secondary-btn inline-flex items-center justify-center gap-2 rounded-[18px] border border-[var(--shell-line)] bg-[var(--shell-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] shadow-sm transition hover:bg-white',

  input:
    'sf-input rounded-[18px] border border-[var(--shell-line)] bg-white shadow-sm outline-none transition placeholder:text-[var(--shell-muted)] focus:border-brand/40 focus:ring-2 focus:ring-brand/15',

  /** Filter / toolbar panels */
  panel: 'sf-panel rounded-[28px] border border-[var(--shell-line)] bg-[var(--shell-surface)] p-4 shadow-[0_14px_32px_-28px_rgba(23,21,18,0.2)] sm:p-5',

  sectionLabel: 'sf-section-label text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--shell-muted)]',

  /** Conversations layout */
  inbox: 'sf-inbox flex flex-1 overflow-hidden rounded-[28px] border border-[var(--shell-line)] bg-[var(--shell-surface)] shadow-[0_18px_36px_-28px_rgba(23,21,18,0.22)]',

  /** Calendar week view shell */
  calendarWeek:
    'sf-calendar-week min-w-0 flex-1 overflow-hidden rounded-[28px] border border-[var(--shell-line)] bg-[var(--shell-surface)] shadow-[0_14px_32px_-28px_rgba(23,21,18,0.2)]',

  /** Empty / loading panels */
  emptyPanel: 'sf-empty-panel rounded-[28px] border border-dashed border-[var(--shell-line)] bg-[var(--shell-surface)] px-8 py-16 text-center',

  /** Settings / forms */
  formCard: 'sf-form-card rounded-[28px] border border-[var(--shell-line)] bg-[var(--shell-surface)] p-5 shadow-[0_14px_32px_-28px_rgba(23,21,18,0.2)] sm:p-6',
  formLabel:
    'mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--shell-muted)]',
  formTitle: 'text-lg font-bold tracking-tight text-[var(--foreground)]',
  formDesc: 'mt-1 text-sm text-[var(--shell-muted)]',

  /** Inputs — full width */
  inputFull: `sf-input w-full rounded-[18px] border border-[var(--shell-line)] bg-white px-4 py-2.5 text-sm text-[var(--foreground)] shadow-sm outline-none transition placeholder:text-[var(--shell-muted)] focus:border-brand/40 focus:ring-2 focus:ring-brand/15`,

  inputSm:
    'sf-input rounded-xl border border-[var(--shell-line)] bg-white px-3 py-2 text-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/15',

  /** Primary actions */
  btnBrand:
    'sf-primary-btn rounded-[18px] border border-[color:var(--brand)] bg-[var(--brand)] px-5 py-2.5 text-sm font-bold text-white shadow-[0_14px_24px_-18px_color-mix(in_srgb,var(--brand)_38%,transparent)] transition hover:brightness-[1.03] disabled:opacity-40',

  btnSave:
    'sf-primary-btn w-full rounded-[18px] border border-[color:var(--brand)] bg-[var(--brand)] py-3 text-sm font-bold text-white shadow-[0_14px_24px_-18px_color-mix(in_srgb,var(--brand)_38%,transparent)] transition hover:brightness-[1.03] disabled:opacity-45',

  tableShell: 'sf-table-shell overflow-hidden rounded-[22px] border border-[var(--shell-line)] bg-[var(--shell-surface)]',
  tableHeadRow: 'sf-table-head-row border-b border-[var(--shell-line)] bg-[var(--shell-canvas)]',
} as const
