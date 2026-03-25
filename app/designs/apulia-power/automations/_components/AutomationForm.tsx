'use client'

import { useState } from 'react'
import { createAutomation, updateAutomation } from '../_actions'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Condition {
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains'
  value: string
}

type ActionType = 'send_internal_notification' | 'create_task' | 'send_sms' | 'add_contact_tag'

interface Action {
  type: ActionType
  config: Record<string, string | number>
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TRIGGERS = [
  { value: 'contact_created',    label: 'Contact Created' },
  { value: 'deal_created',       label: 'Deal Created' },
  { value: 'deal_stage_changed', label: 'Deal Stage Changed' },
  { value: 'appointment_created',label: 'Appointment Created' },
  { value: 'message_received',   label: 'Message Received' },
]

const TRIGGER_FIELDS: Record<string, string[]> = {
  contact_created:     ['contactName', 'contactEmail', 'contactPhone'],
  deal_created:        ['dealName', 'dealValue', 'stageName'],
  deal_stage_changed:  ['stageName', 'dealName', 'dealValue', 'previousStage'],
  appointment_created: ['appointmentTitle', 'calendarName'],
  message_received:    ['direction', 'messageBody'],
}

const OPERATORS = [
  { value: 'equals',      label: 'equals' },
  { value: 'not_equals',  label: 'not equals' },
  { value: 'contains',    label: 'contains' },
  { value: 'not_contains',label: 'does not contain' },
]

const ACTION_TYPES: { value: ActionType; label: string }[] = [
  { value: 'send_internal_notification', label: 'Send Notification' },
  { value: 'create_task',                label: 'Create Task' },
  { value: 'send_sms',                   label: 'Send SMS' },
  { value: 'add_contact_tag',            label: 'Add Contact Tag' },
]

// ─── Defaults ─────────────────────────────────────────────────────────────────

function defaultConfig(type: ActionType): Record<string, string | number> {
  switch (type) {
    case 'send_internal_notification': return { title: '' }
    case 'create_task':                return { title: '', dueHours: 24 }
    case 'send_sms':                   return { message: '' }
    case 'add_contact_tag':            return { tag: '' }
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const INPUT = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-all duration-150 focus:ring-1 focus:ring-gray-300'
const SELECT = `${INPUT} cursor-pointer`
const LABEL = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500'

// ─── Action Config Editor ─────────────────────────────────────────────────────

function ActionConfigEditor({
  action,
  onChange,
}: {
  action: Action
  onChange: (config: Record<string, string | number>) => void
}) {
  const set = (key: string, val: string | number) =>
    onChange({ ...action.config, [key]: val })

  switch (action.type) {
    case 'send_internal_notification':
      return (
        <input
          className={INPUT}
          placeholder="Notification title…"
          value={String(action.config.title ?? '')}
          onChange={(e) => set('title', e.target.value)}
        />
      )
    case 'create_task':
      return (
        <div className="flex gap-2">
          <input
            className={INPUT}
            placeholder="Task title…"
            value={String(action.config.title ?? '')}
            onChange={(e) => set('title', e.target.value)}
          />
          <input
            type="number"
            min={1}
            className="w-28 shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition-all duration-150 focus:ring-1 focus:ring-gray-300"
            placeholder="24h"
            title="Due in hours"
            value={String(action.config.dueHours ?? 24)}
            onChange={(e) => set('dueHours', Number(e.target.value))}
          />
        </div>
      )
    case 'send_sms':
      return (
        <textarea
          rows={2}
          className={`${INPUT} resize-none`}
          placeholder="SMS message text…"
          value={String(action.config.message ?? '')}
          onChange={(e) => set('message', e.target.value)}
        />
      )
    case 'add_contact_tag':
      return (
        <input
          className={INPUT}
          placeholder="Tag name…"
          value={String(action.config.tag ?? '')}
          onChange={(e) => set('tag', e.target.value)}
        />
      )
  }
}

// ─── Main Form ────────────────────────────────────────────────────────────────

interface AutomationFormProps {
  mode: 'create' | 'edit'
  automationId?: string
  initial?: {
    name?: string
    triggerType?: string
    conditions?: Condition[]
    actions?: Action[]
  }
}

export default function AutomationForm({ mode, automationId, initial }: AutomationFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [trigger, setTrigger] = useState(initial?.triggerType ?? 'deal_stage_changed')
  const [conditions, setConditions] = useState<Condition[]>(
    initial?.conditions ?? []
  )
  const [actions, setActions] = useState<Action[]>(
    initial?.actions ?? [{ type: 'send_internal_notification', config: { title: '' } }]
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // ── Condition helpers ──────────────────────────────────────────────────────

  function addCondition() {
    const fields = TRIGGER_FIELDS[trigger] ?? []
    setConditions((prev) => [
      ...prev,
      { field: fields[0] ?? '', operator: 'equals', value: '' },
    ])
  }

  function updateCondition(i: number, partial: Partial<Condition>) {
    setConditions((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...partial } : c)))
  }

  function removeCondition(i: number) {
    setConditions((prev) => prev.filter((_, idx) => idx !== i))
  }

  // ── Action helpers ─────────────────────────────────────────────────────────

  function addAction() {
    setActions((prev) => [
      ...prev,
      { type: 'send_internal_notification', config: { title: '' } },
    ])
  }

  function updateActionType(i: number, type: ActionType) {
    setActions((prev) =>
      prev.map((a, idx) => (idx === i ? { type, config: defaultConfig(type) } : a))
    )
  }

  function updateActionConfig(i: number, config: Record<string, string | number>) {
    setActions((prev) => prev.map((a, idx) => (idx === i ? { ...a, config } : a)))
  }

  function removeAction(i: number) {
    setActions((prev) => prev.filter((_, idx) => idx !== i))
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const fd = new FormData()
    fd.set('name', name)
    fd.set('trigger_type', trigger)
    fd.set('conditions_json', JSON.stringify(conditions))
    fd.set('actions_json', JSON.stringify(actions))

    const result =
      mode === 'create'
        ? await createAutomation(fd)
        : await updateAutomation(automationId!, fd)

    if (result?.error) {
      setError(result.error)
      setSaving(false)
    }
    // success: server action redirects to /designs/apulia-power/automations
  }

  const fieldSuggestions = TRIGGER_FIELDS[trigger] ?? []

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <label className={LABEL}>Automation Name</label>
        <input
          required
          className={INPUT}
          placeholder="e.g. Notify when deal reaches Qualified"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {/* Trigger */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <label className={LABEL}>Trigger</label>
        <select
          className={SELECT}
          value={trigger}
          onChange={(e) => {
            setTrigger(e.target.value)
            setConditions([])
          }}
        >
          {TRIGGERS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Conditions */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <label className={`${LABEL} mb-0`}>Conditions</label>
          <span className="text-xs text-gray-400">Optional — all must match</span>
        </div>

        {conditions.length === 0 && (
          <p className="mb-3 text-xs text-gray-400">No conditions — automation runs on every trigger.</p>
        )}

        <div className="space-y-2">
          {/* datalist for field suggestions */}
          <datalist id="condition-fields">
            {fieldSuggestions.map((f) => <option key={f} value={f} />)}
          </datalist>

          {conditions.map((cond, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                list="condition-fields"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition-all duration-150 focus:ring-1 focus:ring-gray-300"
                placeholder="field"
                value={cond.field}
                onChange={(e) => updateCondition(i, { field: e.target.value })}
              />
              <select
                className="w-36 shrink-0 rounded-lg border border-gray-200 px-2 py-2 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-gray-300"
                value={cond.operator}
                onChange={(e) =>
                  updateCondition(i, { operator: e.target.value as Condition['operator'] })
                }
              >
                {OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>
              <input
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition-all duration-150 focus:ring-1 focus:ring-gray-300"
                placeholder="value"
                value={cond.value}
                onChange={(e) => updateCondition(i, { value: e.target.value })}
              />
              <button
                type="button"
                onClick={() => removeCondition(i)}
                className="shrink-0 rounded-lg p-2 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addCondition}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium text-gray-400 transition-colors hover:text-gray-700"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Add Condition
        </button>
      </div>

      {/* Actions */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <label className={`${LABEL} mb-0`}>Actions</label>
          <span className="text-xs text-gray-400">Run in order when triggered</span>
        </div>

        <div className="space-y-3">
          {actions.map((action, i) => (
            <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="shrink-0 text-xs font-semibold text-gray-400">
                  {i + 1}.
                </span>
                <select
                  className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-gray-300"
                  value={action.type}
                  onChange={(e) => updateActionType(i, e.target.value as ActionType)}
                >
                  {ACTION_TYPES.map((at) => (
                    <option key={at.value} value={at.value}>{at.label}</option>
                  ))}
                </select>
                {actions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeAction(i)}
                    className="shrink-0 rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                )}
              </div>
              <ActionConfigEditor
                action={action}
                onChange={(config) => updateActionConfig(i, config)}
              />
              {action.type === 'create_task' && (
                <p className="mt-1 text-xs text-gray-400">Title · Due in hours (right)</p>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addAction}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium text-gray-400 transition-colors hover:text-gray-700"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Add Action
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={saving || !name.trim()}
        className="w-full rounded-lg bg-black py-3 text-sm font-medium text-white transition-all duration-150 ease-out hover:bg-gray-900 disabled:opacity-40"
      >
        {saving
          ? 'Saving…'
          : mode === 'create'
          ? 'Create Automation'
          : 'Save Changes'}
      </button>
    </form>
  )
}
