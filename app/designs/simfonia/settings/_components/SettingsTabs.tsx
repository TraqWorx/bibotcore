'use client'

import { useState } from 'react'
import SegmentedControl from '../../_components/SegmentedControl'

interface Tab {
  id: string
  label: string
  content: React.ReactNode
}

export default function SettingsTabs({ tabs }: { tabs: Tab[] }) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? '')

  return (
    <div>
      <SegmentedControl
        className="max-w-full"
        tablist
        tabIdPrefix="settings-tab"
        ariaLabel="Sezioni impostazioni"
        items={tabs.map((tab) => ({ value: tab.id, label: tab.label }))}
        value={activeTab}
        onChange={setActiveTab}
        scrollable
        equalWidth={false}
        size="sm"
      />

      <div className="mt-8">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            role="tabpanel"
            id={`settings-panel-${tab.id}`}
            aria-labelledby={`settings-tab-${tab.id}`}
            hidden={tab.id !== activeTab}
          >
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  )
}
