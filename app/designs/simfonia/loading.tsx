export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-gray-200" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border border-gray-100 bg-gray-50" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl border border-gray-100 bg-gray-50" />
    </div>
  )
}
