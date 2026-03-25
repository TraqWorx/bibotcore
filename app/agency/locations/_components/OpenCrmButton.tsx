'use client'

export default function OpenCrmButton({ locationId, designSlug }: { locationId: string; designSlug: string }) {
  function handleClick() {
    localStorage.setItem('activeLocationId', locationId)
    document.cookie = `active_location_id=${locationId}; path=/; max-age=2592000; SameSite=Lax`
    window.open(`/designs/${designSlug}/dashboard?locationId=${locationId}`, '_blank')
  }

  return (
    <button
      onClick={handleClick}
      className="rounded-lg bg-[#2A00CC] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1A0099] transition-colors"
    >
      Open CRM
    </button>
  )
}
