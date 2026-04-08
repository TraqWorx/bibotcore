'use client'

import { useDashboardFilters } from './DashboardFilterContext'

export default function DashboardFilterBar() {
  const { filters, setFilters, users, loadingUsers } = useDashboardFilters()

  if (loadingUsers || users.length === 0) return null

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--shell-line)] px-4 py-2.5" style={{ backgroundColor: 'var(--shell-surface)' }}>
      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--shell-muted)' }}>Filter by</span>
      <select
        value={filters.userId ?? ''}
        onChange={(e) => setFilters({ ...filters, userId: e.target.value || undefined })}
        className="rounded-lg border px-3 py-1.5 text-sm font-medium outline-none"
        style={{
          borderColor: 'var(--shell-line)',
          backgroundColor: 'var(--shell-soft)',
          color: 'var(--foreground)',
        }}
      >
        <option value="">All Users</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.name}</option>
        ))}
      </select>
      {filters.userId && (
        <button
          onClick={() => setFilters({})}
          className="rounded-lg px-2 py-1 text-xs font-medium transition hover:opacity-70"
          style={{ color: 'var(--brand)' }}
        >
          Clear
        </button>
      )}
    </div>
  )
}
