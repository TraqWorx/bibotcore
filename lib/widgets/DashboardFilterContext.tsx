'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export interface DashboardFilters {
  userId?: string
}

interface FilterContextValue {
  filters: DashboardFilters
  setFilters: (f: DashboardFilters) => void
  users: { id: string; name: string; email: string }[]
  loadingUsers: boolean
}

const FilterContext = createContext<FilterContextValue>({
  filters: {},
  setFilters: () => {},
  users: [],
  loadingUsers: false,
})

export function useDashboardFilters() {
  return useContext(FilterContext)
}

export function DashboardFilterProvider({
  locationId,
  children,
}: {
  locationId: string
  children: ReactNode
}) {
  const [filters, setFilters] = useState<DashboardFilters>({})
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)

  useEffect(() => {
    fetch('/api/widgets/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId, dataSource: 'users' }),
    })
      .then((r) => r.json())
      .then((d) => {
        const raw = d.data?.users ?? []
        setUsers(raw.map((u: { id?: string; name?: string; firstName?: string; lastName?: string; email?: string }) => ({
          id: u.id ?? '',
          name: u.name ?? (`${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email || 'Unknown'),
          email: u.email ?? '',
        })))
      })
      .catch(() => {})
      .finally(() => setLoadingUsers(false))
  }, [locationId])

  return (
    <FilterContext.Provider value={{ filters, setFilters, users, loadingUsers }}>
      {children}
    </FilterContext.Provider>
  )
}
