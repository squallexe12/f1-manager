'use client'

import { useState, useMemo } from 'react'
import type { Race, TireCompound } from '@/types/race'
import type { Driver } from '@/types/driver'
import type { Team } from '@/types/team'
import { Badge } from '@/components/ui/badge'

export interface StrategyPlan {
  id: string
  name: string
  description: string
  stops: { lap: number; compound: TireCompound }[]
  startCompound: TireCompound
  confidence: number
  riskLevel: 'low' | 'medium' | 'high'
  recommended: boolean
}

/** Map of driverId → selected strategy */
export type DriverStrategies = Record<string, StrategyPlan>

interface StrategyPlannerProps {
  race: Race
  team: Team
  playerDrivers: Driver[]
  onSelectStrategies: (strategies: DriverStrategies) => void
  className?: string
}

const COMPOUND_COLORS: Record<string, string> = {
  C1: '#FFFFFF', C2: '#FFC800', C3: '#FF3B30', C4: '#FF3B30', C5: '#FF3B30',
}

const COMPOUND_LABELS: Record<string, string> = {
  C1: 'Hard', C2: 'Medium', C3: 'Soft', C4: 'Soft', C5: 'Ultra',
}

function generateStrategies(race: Race): StrategyPlan[] {
  const { circuit } = race
  const laps = circuit.laps
  const compounds = circuit.compounds

  const tireWearFactor = circuit.tireWear === 'high' ? 1.4 : circuit.tireWear === 'medium' ? 1.0 : 0.7

  const oneStopLap = Math.round(laps * (0.50 + (tireWearFactor - 1) * -0.1))
  const oneStop: StrategyPlan = {
    id: 'one-stop-optimal',
    name: 'Optimal 1-Stop',
    description: `Start ${COMPOUND_LABELS[compounds[1]]}s, pit lap ${oneStopLap} → ${COMPOUND_LABELS[compounds[0]]}s`,
    stops: [{ lap: oneStopLap, compound: compounds[0] }],
    startCompound: compounds[1],
    confidence: tireWearFactor <= 1.0 ? 85 : 70,
    riskLevel: 'low',
    recommended: tireWearFactor <= 1.0,
  }

  const aggressiveStopLap = Math.round(laps * 0.30)
  const aggressive: StrategyPlan = {
    id: 'aggressive-1stop',
    name: 'Aggressive 1-Stop',
    description: `Start ${COMPOUND_LABELS[compounds[2]]}s, pit lap ${aggressiveStopLap} → ${COMPOUND_LABELS[compounds[0]]}s`,
    stops: [{ lap: aggressiveStopLap, compound: compounds[0] }],
    startCompound: compounds[2],
    confidence: 65,
    riskLevel: 'medium',
    recommended: false,
  }

  const twoStop1 = Math.round(laps * 0.30)
  const twoStop2 = Math.round(laps * 0.65)
  const twoStop: StrategyPlan = {
    id: 'two-stop',
    name: '2-Stop Strategy',
    description: `Start ${COMPOUND_LABELS[compounds[2]]}s → L${twoStop1} ${COMPOUND_LABELS[compounds[1]]}s → L${twoStop2} ${COMPOUND_LABELS[compounds[0]]}s`,
    stops: [
      { lap: twoStop1, compound: compounds[1] },
      { lap: twoStop2, compound: compounds[0] },
    ],
    startCompound: compounds[2],
    confidence: tireWearFactor >= 1.4 ? 80 : 55,
    riskLevel: tireWearFactor >= 1.4 ? 'low' : 'high',
    recommended: tireWearFactor >= 1.4,
  }

  const undercutLap = Math.round(laps * 0.40)
  const undercut: StrategyPlan = {
    id: 'undercut',
    name: 'Undercut',
    description: `Start ${COMPOUND_LABELS[compounds[1]]}s, early pit L${undercutLap} → ${COMPOUND_LABELS[compounds[2]]}s`,
    stops: [{ lap: undercutLap, compound: compounds[2] }],
    startCompound: compounds[1],
    confidence: 55,
    riskLevel: 'high',
    recommended: false,
  }

  return [oneStop, aggressive, twoStop, undercut]
    .sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0) || b.confidence - a.confidence)
}

export function StrategyPlanner({ race, team, playerDrivers, onSelectStrategies, className = '' }: StrategyPlannerProps) {
  const strategies = useMemo(() => generateStrategies(race), [race])
  const [activeDriver, setActiveDriver] = useState(0)
  const [selections, setSelections] = useState<Record<string, string>>(() => {
    // Default: both drivers get the recommended strategy
    const recommended = strategies.find(s => s.recommended) ?? strategies[0]
    const init: Record<string, string> = {}
    for (const d of playerDrivers) {
      init[d.id] = recommended?.id ?? ''
    }
    return init
  })

  function handleSelect(plan: StrategyPlan) {
    const driverId = playerDrivers[activeDriver]?.id
    if (!driverId) return

    const newSelections = { ...selections, [driverId]: plan.id }
    setSelections(newSelections)

    // Build full strategy map and emit
    const strategyMap: DriverStrategies = {}
    for (const d of playerDrivers) {
      const selectedPlan = strategies.find(s => s.id === newSelections[d.id]) ?? strategies[0]
      strategyMap[d.id] = selectedPlan
    }
    onSelectStrategies(strategyMap)
  }

  const currentDriverId = playerDrivers[activeDriver]?.id ?? ''
  const currentSelectedId = selections[currentDriverId] ?? ''

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)]">
          AI Strategy Recommendations
        </h3>
        <Badge variant="cyan">AI Agent</Badge>
      </div>

      {/* Driver tabs */}
      <div className="flex gap-1">
        {playerDrivers.map((d, i) => (
          <button
            key={d.id}
            onClick={() => setActiveDriver(i)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-heading font-semibold uppercase tracking-wider
              transition-colors duration-150 outline-none
              focus-visible:ring-2 focus-visible:ring-[var(--accent-lime)]/50
              ${activeDriver === i
                ? 'bg-[var(--accent-lime)]/10 text-[var(--accent-lime)] border border-[var(--accent-lime)]/30'
                : 'text-[var(--text-dim)] border border-transparent hover:text-[var(--text-secondary)]'
              }
            `}
          >
            <div className="w-1.5 h-3 rounded-full" style={{ backgroundColor: team.color }} />
            {d.shortName}
            {selections[d.id] && (
              <span className="text-[8px] text-[var(--accent-cyan)]">
                {strategies.find(s => s.id === selections[d.id])?.name.substring(0, 8)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Strategy options */}
      <div className="flex flex-col gap-2">
        {strategies.map(plan => (
          <button
            key={plan.id}
            onClick={() => handleSelect(plan)}
            className={`
              text-left p-3 rounded-lg border transition-colors duration-150
              outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-lime)]/50
              ${currentSelectedId === plan.id
                ? 'bg-[var(--accent-lime)]/[0.06] border-[var(--accent-lime)]/40'
                : 'bg-[var(--bg-surface)] border-[var(--border-default)] hover:border-[var(--border-hover)]'
              }
            `}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-heading font-semibold text-[var(--text-primary)]">
                  {plan.name}
                </span>
                {plan.recommended && <Badge variant="lime">Recommended</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={plan.riskLevel === 'low' ? 'lime' : plan.riskLevel === 'medium' ? 'amber' : 'red'}>
                  {plan.riskLevel}
                </Badge>
                <span className="text-[10px] font-mono text-[var(--accent-cyan)]">
                  {plan.confidence}%
                </span>
              </div>
            </div>

            <p className="text-[10px] text-[var(--text-secondary)] mb-2">{plan.description}</p>

            {/* Stint bar */}
            <div className="flex h-2.5 rounded-full overflow-hidden bg-white/[0.04]">
              <StintBar compound={plan.startCompound} startLap={0} endLap={plan.stops[0]?.lap ?? race.circuit.laps} totalLaps={race.circuit.laps} />
              {plan.stops.map((stop, i) => {
                const nextEnd = plan.stops[i + 1]?.lap ?? race.circuit.laps
                return <StintBar key={i} compound={stop.compound} startLap={stop.lap} endLap={nextEnd} totalLaps={race.circuit.laps} />
              })}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function StintBar({ compound, startLap, endLap, totalLaps }: { compound: TireCompound; startLap: number; endLap: number; totalLaps: number }) {
  const width = ((endLap - startLap) / totalLaps) * 100
  return (
    <div
      className="h-full"
      style={{ width: `${width}%`, backgroundColor: COMPOUND_COLORS[compound] ?? '#888', opacity: 0.7 }}
      title={`${COMPOUND_LABELS[compound] ?? compound}: Lap ${startLap}-${endLap}`}
    />
  )
}
