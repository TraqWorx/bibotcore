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
    <div className="space-y-8">
      <SegmentedControl
        className="w-full max-w-full"
        listClassName="w-full rounded-[26px] border-[var(--shell-line)] bg-[var(--shell-surface)] p-2 shadow-[0_14px_32px_-26px_rgba(23,21,18,0.16)]"
        tablist
        tabIdPrefix="settings-tab"
        ariaLabel="Sezioni impostazioni"
        items={tabs.map((tab) => ({ value: tab.id, label: tab.label }))}
        value={activeTab}
        onChange={setActiveTab}
        scrollable
        equalWidth
        size="lg"
      />

      <div>
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
