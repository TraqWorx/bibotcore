'use client'

import { useRouter, useSearchParams } from 'next/navigation'

type Contact = {
  id: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  tags?: string[]
}

const TAG_COLORS: Record<string, string> = {
  energia:      'bg-amber-50 text-amber-700 border-amber-200',
  telefonia:    'bg-blue-50 text-blue-700 border-blue-200',
  wind:         'bg-purple-50 text-purple-700 border-purple-200',
  fastweb:      'bg-orange-50 text-orange-700 border-orange-200',
  connettivita: 'bg-teal-50 text-teal-700 border-teal-200',
}

export default function ContactRow({ contact }: { contact: Contact }) {
  const router = useRouter()
  const sp = useSearchParams()
  const locationId = sp.get('locationId') ?? ''

  return (
    <tr
      className="cursor-pointer transition-colors hover:bg-gray-50"
      onClick={() => router.push(`/designs/simfonia/contacts/${contact.id}?locationId=${locationId}`)}
    >
      <td className="px-5 py-3 font-medium text-gray-900">
        {[contact.firstName, contact.lastName].filter(Boolean).join(' ') || '—'}
      </td>
      <td className="px-5 py-3 text-gray-500">{contact.email ?? '—'}</td>
      <td className="px-5 py-3 text-gray-500">{contact.phone ?? '—'}</td>
      <td className="px-5 py-3">
        <div className="flex flex-wrap gap-1">
          {(contact.tags ?? []).slice(0, 4).map((tag) => (
            <span
              key={tag}
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                TAG_COLORS[tag.toLowerCase()] ?? 'bg-gray-50 text-gray-600 border-gray-200'
              }`}
            >
              {tag}
            </span>
          ))}
        </div>
      </td>
    </tr>
  )
}
