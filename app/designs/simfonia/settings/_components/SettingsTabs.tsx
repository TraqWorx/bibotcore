'use client'

import { useState } from 'react'

interface Tab {
  id: string
  label: string
  content: React.ReactNode
}

export default function SettingsTabs({ tabs }: { tabs: Tab[] }) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? '')

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="shrink-0 rounded-lg px-4 py-2 text-xs font-semibold whitespace-nowrap"
            style={
              activeTab === tab.id
                ? { background: '#2A00CC', color: 'white' }
                : { background: 'transparent', color: '#6B7280' }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content — only active tab is mounted */}
      <div className="mt-6">
        {tabs.map((tab) => (
          <div key={tab.id} className={tab.id === activeTab ? '' : 'hidden'}>
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  )
}
