'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { deleteDesign } from '../_actions'
import DuplicateButton from './DuplicateButton'
import { ad } from '@/lib/admin/ui'

interface DesignRow {
  id: string
  name: string
  slug: string
}

export default function DesignsTable({ rows }: { rows: DesignRow[] }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return rows
    return rows.filter(
      (row) => row.name.toLowerCase().includes(q) || row.slug.toLowerCase().includes(q)
    )
  }, [rows, search])

  return (
    <div className={ad.tableShell}>
      {/* Filter bar */}
      <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/50 px-4 py-3">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200/90 bg-white px-3 py-1.5 shadow-sm">
          <svg className="h-4 w-4 shrink-0 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
          <input
            type="text"
            placeholder="Search by name or slug…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-base leading-none text-gray-400 hover:text-gray-600">×</button>
          )}
        </div>
        <span className="shrink-0 text-xs text-gray-400">
          {filtered.length} / {rows.length}
        </span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="p-6 text-sm text-gray-400">No results match your search.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className={ad.tableHeadRow}>
              <th className="w-10 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">#</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Slug</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={row.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
                <td className="px-4 py-3 text-xs text-gray-400 tabular-nums">{i + 1}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{row.slug}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3">
                    <Link
                      href={`/admin/designs/${row.slug}/settings`}
                      className="text-xs font-bold text-brand underline-offset-4 transition-colors hover:underline"
                    >
                      Settings
                    </Link>
                    {row.slug === 'simfonia' ? (
                      <Link
                        href="/designs/simfonia/demo"
                        className="text-xs font-bold text-brand underline-offset-4 transition-colors hover:underline"
                      >
                        Demo
                      </Link>
                    ) : null}
                    <DuplicateButton slug={row.slug} />
                    <form action={deleteDesign.bind(null, row.slug) as unknown as string}>
                      <button
                        type="submit"
                        className="text-xs font-medium text-gray-400 transition-colors hover:text-red-600"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
