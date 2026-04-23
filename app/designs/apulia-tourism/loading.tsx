import { sf } from '@/lib/simfonia/ui'

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="h-10 w-56 animate-pulse rounded-2xl bg-white/50" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`${sf.statTile} h-32 animate-pulse bg-gray-100/60`} />
        ))}
      </div>
      <div className={`${sf.card} h-72 animate-pulse bg-gray-100/50`} />
    </div>
  )
}
