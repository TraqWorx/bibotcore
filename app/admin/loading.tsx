import { ad } from '@/lib/admin/ui'

export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <div className="h-9 w-56 animate-pulse rounded-2xl bg-gray-200/70" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`${ad.card} h-24 animate-pulse bg-gray-100/70`} />
        ))}
      </div>
      <div className={`${ad.card} h-64 animate-pulse bg-gray-100/70`} />
    </div>
  )
}
