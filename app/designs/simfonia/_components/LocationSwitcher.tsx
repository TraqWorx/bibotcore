'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

interface Location {
  location_id: string
  design_slug: string | null
  name: string
}

interface Props {
  locations: Location[]
  currentLocationId: string
}

const LS_KEY = 'activeLocationId'

export default function LocationSwitcher({ locations, currentLocationId }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(currentLocationId)

  useEffect(() => {
    localStorage.setItem(LS_KEY, currentLocationId)
  }, [currentLocationId])

  useEffect(() => {
    if (!searchParams.get('locationId')) {
      const stored = localStorage.getItem(LS_KEY)
      if (stored && stored !== currentLocationId) {
        const params = new URLSearchParams(searchParams.toString())
        params.set('locationId', stored)
        router.replace(`${pathname}?${params.toString()}`)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(locationId: string) {
    setValue(locationId)
    localStorage.setItem(LS_KEY, locationId)
    const designSlug = locations.find((l) => l.location_id === locationId)?.design_slug ?? 'simfonia'
    const params = new URLSearchParams(searchParams.toString())
    params.set('locationId', locationId)
    router.push(`/designs/${designSlug}/dashboard?${params.toString()}`)
  }

  if (locations.length <= 1) return null

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        aria-label="Cambia location"
        className="h-11 min-w-[220px] appearance-none rounded-2xl border border-gray-200/80 bg-white/90 py-2 pl-4 pr-10 text-sm font-semibold text-gray-800 shadow-sm outline-none backdrop-blur-sm transition hover:border-brand/25 focus:border-brand/40 focus:ring-2 focus:ring-brand/15"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 0.65rem center',
          backgroundSize: '1.1rem',
        }}
      >
        {locations.map((loc) => (
          <option key={loc.location_id} value={loc.location_id}>
            {loc.name}
          </option>
        ))}
      </select>
    </div>
  )
}
