'use client'

import { SCENARIOS } from '@/data/scenarios'
import type { ScenarioType } from '@/types/game'
import { Badge } from '@/components/ui/badge'

interface ScenarioSelectorProps {
  selectedTeamId: string
  selectedScenario: ScenarioType | null
  onSelect: (scenario: ScenarioType) => void
}

const DIFFICULTY: Record<ScenarioType, { label: string; variant: 'lime' | 'cyan' | 'amber' | 'red' }> = {
  'golden-era': { label: 'Easy', variant: 'lime' },
  'rebuild': { label: 'Medium', variant: 'amber' },
  'newcomer': { label: 'Hard', variant: 'red' },
  'crisis': { label: 'Extreme', variant: 'red' },
}

export function ScenarioSelector({ selectedTeamId, selectedScenario, onSelect }: ScenarioSelectorProps) {
  const available = SCENARIOS.filter(s =>
    s.availableTeams === 'all' || s.availableTeams.includes(selectedTeamId)
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {available.map((scenario) => {
        const isSelected = selectedScenario === scenario.id
        const diff = DIFFICULTY[scenario.id]

        return (
          <button
            key={scenario.id}
            onClick={() => onSelect(scenario.id)}
            className={`
              text-left rounded-lg p-4
              border transition-all duration-150 outline-none
              focus-visible:ring-2 focus-visible:ring-[var(--accent-lime)]/50
              ${isSelected
                ? 'border-[var(--accent-lime)] bg-[var(--accent-lime)]/[0.04] shadow-[0_0_20px_rgba(204,255,0,0.08)]'
                : 'border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)]'
              }
            `}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-heading font-bold text-[var(--text-primary)]">
                {scenario.name}
              </span>
              <Badge variant={diff.variant}>{diff.label}</Badge>
            </div>

            <p className="text-xs text-[var(--text-secondary)] mb-3 leading-relaxed">
              {scenario.description}
            </p>

            {/* Modifiers */}
            <div className="flex gap-3 text-[10px] font-mono text-[var(--text-dim)]">
              <span>Budget: {scenario.budgetModifier >= 1 ? '+' : ''}{Math.round((scenario.budgetModifier - 1) * 100)}%</span>
              <span>Car: {scenario.carPerformanceModifier >= 0 ? '+' : ''}{scenario.carPerformanceModifier}</span>
              <span>Morale: {scenario.moraleModifier >= 0 ? '+' : ''}{scenario.moraleModifier}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
