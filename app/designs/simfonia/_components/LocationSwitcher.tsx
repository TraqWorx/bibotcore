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

  // Persist to localStorage on mount
  useEffect(() => {
    localStorage.setItem(LS_KEY, currentLocationId)
  }, [currentLocationId])

  // On mount: if no locationId in URL, restore from localStorage and redirect
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
    <select
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 outline-none focus:ring-1 focus:ring-gray-300"
    >
      {locations.map((loc) => (
        <option key={loc.location_id} value={loc.location_id}>
          {loc.name}
        </option>
      ))}
    </select>
  )
}
