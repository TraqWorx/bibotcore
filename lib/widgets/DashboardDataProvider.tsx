'use client'

import { createContext, useContext, type ReactNode } from 'react'
import useSWR from 'swr'
import type { DashboardData } from './types'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface DashboardContextValue {
  data: DashboardData | null
  isLoading: boolean
  locationId: string
}

const DashboardContext = createContext<DashboardContextValue>({
  data: null,
  isLoading: true,
  locationId: '',
})

export function useDashboardData() {
  return useContext(DashboardContext)
}

export function DashboardDataProvider({
  locationId,
  demoData,
  children,
}: {
  locationId: string
  demoData?: DashboardData
  children: ReactNode
}) {
  const { data: swrData, isLoading } = useSWR<DashboardData>(
    demoData ? null : `/api/dashboard?locationId=${locationId}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 10000 },
  )

  const data = demoData ?? swrData ?? null

  return (
    <DashboardContext.Provider value={{ data, isLoading: !demoData && isLoading, locationId }}>
      {children}
    </DashboardContext.Provider>
  )
}
