'use client'

interface Pipeline {
  id: string
  name: string
}

export default function PipelineSelector({
  pipelines,
  selected,
  onChange,
}: {
  pipelines: Pipeline[]
  selected: string
  onChange: (id: string) => void
}) {
  return (
    <select
      className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 outline-none transition-colors focus:border-[#2A00CC] focus:ring-2 focus:ring-[rgba(42,0,204,0.15)]"
      value={selected}
      onChange={(e) => onChange(e.target.value)}
    >
      {pipelines.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  )
}
