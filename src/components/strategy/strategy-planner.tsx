'use client'

import { useState, useMemo } from 'react'
import type { Race, TireCompound } from '@/types/race'
import type { Driver } from '@/types/driver'
import type { Team } from '@/types/team'
import { colorForCompound, labelForCompound, roleForCompound } from '@/components/tire-roles'

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

function generateStrategies(race: Race): StrategyPlan[] {
  const { circuit } = race
  const laps = circuit.laps
  const compounds = circuit.compounds
  const lbl = (c: TireCompound) => labelForCompound(c, compounds)

  const tireWearFactor = circuit.tireWear === 'high' ? 1.4 : circuit.tireWear === 'medium' ? 1.0 : 0.7

  const oneStopLap = Math.round(laps * (0.50 + (tireWearFactor - 1) * -0.1))
  const oneStop: StrategyPlan = {
    id: 'one-stop-optimal',
    name: 'Optimal 1-Stop',
    description: `Start ${lbl(compounds[1])}s, pit lap ${oneStopLap} → ${lbl(compounds[0])}s`,
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
    description: `Start ${lbl(compounds[2])}s, pit lap ${aggressiveStopLap} → ${lbl(compounds[0])}s`,
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
    description: `Start ${lbl(compounds[2])}s → L${twoStop1} ${lbl(compounds[1])}s → L${twoStop2} ${lbl(compounds[0])}s`,
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
    description: `Start ${lbl(compounds[1])}s, early pit L${undercutLap} → ${lbl(compounds[2])}s`,
    stops: [{ lap: undercutLap, compound: compounds[2] }],
    startCompound: compounds[1],
    confidence: 55,
    riskLevel: 'high',
    recommended: false,
  }

  return [oneStop, aggressive, twoStop, undercut]
    .sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0) || b.confidence - a.confidence)
}

// ─── Gantt stint segment ────────────────────────────────────────────────────

function GanttStint({
  compound,
  startLap,
  endLap,
  totalLaps,
  circuitCompounds,
}: {
  compound: TireCompound
  startLap: number
  endLap: number
  totalLaps: number
  circuitCompounds: readonly TireCompound[]
}) {
  const left = (startLap / totalLaps) * 100
  const width = ((endLap - startLap) / totalLaps) * 100
  const role = roleForCompound(compound, circuitCompounds)
  const roleClass = role === 'soft' ? 'S' : role === 'medium' ? 'M' : 'H'
  const label = labelForCompound(compound, circuitCompounds).substring(0, 1)

  const bgColor =
    role === 'soft'
      ? 'var(--c-soft)'
      : role === 'medium'
        ? 'var(--c-med)'
        : 'var(--c-hard)'

  const textColor = role === 'hard' ? 'var(--bg-void, #0a0a0a)' : 'var(--bg-void, #0a0a0a)'

  return (
    <div
      className="absolute top-0 bottom-0 flex items-center justify-center font-mono text-[10px] font-bold"
      style={{
        left: `${left}%`,
        width: `${width}%`,
        backgroundColor: bgColor,
        color: textColor,
        borderRight: '2px solid var(--bg-void)',
        letterSpacing: '0.08em',
      }}
      title={`${labelForCompound(compound, circuitCompounds)}: Lap ${startLap}–${endLap}`}
      data-role={roleClass}
    >
      {width > 6 ? label : ''}
    </div>
  )
}

// ─── Pit marker ─────────────────────────────────────────────────────────────

function PitMarker({ lap, totalLaps }: { lap: number; totalLaps: number }) {
  const left = (lap / totalLaps) * 100
  return (
    <div
      className="absolute"
      style={{
        left: `${left}%`,
        top: '-4px',
        bottom: '-4px',
        width: '2px',
        background: 'var(--sig-amber)',
        boxShadow: '0 0 6px var(--sig-amber)',
        transform: 'translateX(-50%)',
      }}
      title={`Pit stop: Lap ${lap}`}
    />
  )
}

// ─── Lap mark grid ──────────────────────────────────────────────────────────

function LapMarkGrid({ totalLaps }: { totalLaps: number }) {
  const marks = [0.25, 0.5, 0.75].map(f => Math.round(f * totalLaps))
  return (
    <>
      {marks.map(lap => (
        <div
          key={lap}
          className="absolute top-0 bottom-0 opacity-30"
          style={{
            left: `${(lap / totalLaps) * 100}%`,
            width: '1px',
            background: 'var(--line-hair)',
          }}
        />
      ))}
    </>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function StrategyPlanner({ race, team, playerDrivers, onSelectStrategies, className = '' }: StrategyPlannerProps) {
  const strategies = useMemo(() => generateStrategies(race), [race])
  const [activeDriver, setActiveDriver] = useState(0)
  const [selections, setSelections] = useState<Record<string, string>>(() => {
    const recommended = strategies.find(s => s.recommended) ?? strategies[0]
    const init: Record<string, string> = {}
    for (const d of playerDrivers) {
      init[d.id] = recommended?.id ?? ''
    }
    return init
  })

  function handleSelect(driverId: string, planId: string) {
    const newSelections = { ...selections, [driverId]: planId }
    setSelections(newSelections)
    const strategyMap: DriverStrategies = {}
    for (const d of playerDrivers) {
      const selectedPlan = strategies.find(s => s.id === newSelections[d.id]) ?? strategies[0]
      strategyMap[d.id] = selectedPlan
    }
    onSelectStrategies(strategyMap)
  }

  const totalLaps = race.circuit.laps
  const circuitCompounds = race.circuit.compounds

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Planner title card — .planner-title-card */}
      <div
        className="relative overflow-hidden rounded-rad border border-line-sub bg-surface-paper px-[22px] py-5"
      >
        {/* Red left border accent */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-sig-red" />
        <div className="font-mono text-[10px] tracking-[0.2em] text-sig-red uppercase font-bold">
          Race Strategy
        </div>
        <div className="font-display font-extrabold text-[36px] text-ink-hi leading-none tracking-tight mt-1.5">
          Planner
        </div>
        <div className="font-body text-[12px] text-ink-mute mt-1.5">
          Select one strategy per driver. The chosen plan feeds into race simulation.
        </div>
      </div>

      {/* Driver selector tabs */}
      <div className="flex gap-1">
        {playerDrivers.map((d, i) => {
          const isActive = activeDriver === i
          const chosenPlan = strategies.find(s => s.id === selections[d.id])
          return (
            <button
              key={d.id}
              onClick={() => setActiveDriver(i)}
              className={[
                'flex items-center gap-2 px-4 py-2 rounded-rad text-[10px] font-mono font-semibold uppercase tracking-wider outline-none',
                'transition-[background,border-color] duration-[120ms]',
                'focus-visible:ring-2 focus-visible:ring-sig-red/50',
                isActive
                  ? 'bg-surface-raised border border-line-strong text-ink-hi'
                  : 'bg-transparent border border-line-sub text-ink-mute hover:text-ink-body hover:border-line-strong',
              ].join(' ')}
            >
              <div className="w-1.5 h-3 rounded-full" style={{ backgroundColor: team.color }} />
              {d.shortName}
              {chosenPlan && (
                <span className="text-[8px] text-sig-amber hidden sm:inline">
                  {chosenPlan.name.substring(0, 8)}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Gantt timeline — .timeline-wrap */}
      <div className="rounded-rad border border-line-sub bg-surface-paper overflow-hidden">
        {/* Timeline header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-line-hair bg-surface-raised">
          <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-ink-hi font-semibold">
            Strategy Gantt
          </span>
          <span className="font-mono text-[10px] text-ink-dim">
            {totalLaps} laps
          </span>
        </div>

        {/* Column labels */}
        <div
          className="grid gap-3.5 px-4 py-2.5 border-b border-line-hair font-mono text-[9px] tracking-[0.16em] text-ink-dim uppercase"
          style={{ gridTemplateColumns: '130px 1fr 80px' }}
        >
          <span>Driver</span>
          <span>Strategy</span>
          <span className="text-right">Status</span>
        </div>

        {/* One .gantt-row per player driver */}
        {playerDrivers.map((driver, driverIdx) => {
          const chosenId = selections[driver.id] ?? ''
          const plan = strategies.find(s => s.id === chosenId) ?? strategies[0]
          if (!plan) return null

          return (
            <div
              key={driver.id}
              className="border-b border-line-hair last:border-b-0"
            >
              {/* Gantt row */}
              <div
                className="grid gap-3.5 px-4 py-3 items-center"
                style={{ gridTemplateColumns: '130px 1fr 80px' }}
              >
                {/* Label column — .gantt-label */}
                <div className="flex flex-col gap-1">
                  <span
                    className="font-display font-bold text-[15px] text-ink-hi cursor-pointer"
                    onClick={() => setActiveDriver(driverIdx)}
                  >
                    {driver.shortName}
                  </span>
                  <span className="font-mono text-[9px] tracking-[0.14em] text-ink-dim uppercase">
                    {plan.recommended ? (
                      <span className="text-sig-green font-bold">RECOMMENDED</span>
                    ) : (
                      plan.name.substring(0, 14)
                    )}
                  </span>
                </div>

                {/* Track column — .gantt-track */}
                <div
                  className="relative h-11 border border-line-hair rounded-[1px] overflow-visible bg-surface-void"
                  style={{ minWidth: 0 }}
                >
                  <LapMarkGrid totalLaps={totalLaps} />
                  {/* Stints */}
                  <GanttStint
                    compound={plan.startCompound}
                    startLap={0}
                    endLap={plan.stops[0]?.lap ?? totalLaps}
                    totalLaps={totalLaps}
                    circuitCompounds={circuitCompounds}
                  />
                  {plan.stops.map((stop, si) => {
                    const nextEnd = plan.stops[si + 1]?.lap ?? totalLaps
                    return (
                      <GanttStint
                        key={si}
                        compound={stop.compound}
                        startLap={stop.lap}
                        endLap={nextEnd}
                        totalLaps={totalLaps}
                        circuitCompounds={circuitCompounds}
                      />
                    )
                  })}
                  {/* Pit markers */}
                  {plan.stops.map((stop, si) => (
                    <PitMarker key={si} lap={stop.lap} totalLaps={totalLaps} />
                  ))}
                </div>

                {/* Confidence column → replaced with "CHOSEN" badge (§7 drop list) */}
                <div className="flex flex-col items-end gap-1.5">
                  <span className="font-mono text-[9px] tracking-[0.14em] uppercase font-bold text-ink-hi border border-line-sub rounded-[2px] px-2 py-0.5 bg-surface-raised">
                    CHOSEN
                  </span>
                  {plan.stops.length > 0 && (
                    <span className="font-mono text-[9px] text-ink-dim">
                      {plan.stops.length} pit{plan.stops.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Inline strategy selector for the active driver */}
              {activeDriver === driverIdx && (
                <div className="px-4 pb-3 flex flex-col gap-1.5">
                  <div className="font-mono text-[9px] tracking-[0.16em] uppercase text-ink-dim mb-1">
                    Select strategy for {driver.shortName}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {strategies.map(s => {
                      const isChosen = selections[driver.id] === s.id
                      return (
                        <button
                          key={s.id}
                          onClick={() => handleSelect(driver.id, s.id)}
                          className={[
                            'text-left px-3 py-2 rounded-rad border font-mono text-[10px] outline-none',
                            'transition-[background,border-color] duration-[120ms]',
                            'focus-visible:ring-2 focus-visible:ring-sig-red/50',
                            isChosen
                              ? 'bg-sig-red/10 border-sig-red/50 text-ink-hi'
                              : 'bg-surface-paper border-line-sub text-ink-mute hover:border-line-strong hover:text-ink-body',
                          ].join(' ')}
                        >
                          <div className="font-semibold text-ink-hi text-[11px] mb-0.5">{s.name}</div>
                          <div className="text-ink-dim text-[9px] leading-relaxed">{s.description}</div>
                          {/* Stint mini-bar */}
                          <div className="flex h-1.5 rounded-full overflow-hidden mt-1.5 bg-surface-void">
                            <MiniStintBar
                              compound={s.startCompound}
                              startLap={0}
                              endLap={s.stops[0]?.lap ?? totalLaps}
                              totalLaps={totalLaps}
                              circuitCompounds={circuitCompounds}
                            />
                            {s.stops.map((stop, si) => {
                              const nextEnd = s.stops[si + 1]?.lap ?? totalLaps
                              return (
                                <MiniStintBar
                                  key={si}
                                  compound={stop.compound}
                                  startLap={stop.lap}
                                  endLap={nextEnd}
                                  totalLaps={totalLaps}
                                  circuitCompounds={circuitCompounds}
                                />
                              )
                            })}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Mini stint bar (for inline strategy selector) ──────────────────────────

function MiniStintBar({
  compound,
  startLap,
  endLap,
  totalLaps,
  circuitCompounds,
}: {
  compound: TireCompound
  startLap: number
  endLap: number
  totalLaps: number
  circuitCompounds: readonly TireCompound[]
}) {
  const width = ((endLap - startLap) / totalLaps) * 100
  const color = colorForCompound(compound, circuitCompounds)
  return (
    <div
      className="h-full"
      style={{ width: `${width}%`, backgroundColor: color, opacity: 0.8 }}
      title={`${labelForCompound(compound, circuitCompounds)}: Lap ${startLap}–${endLap}`}
    />
  )
}
