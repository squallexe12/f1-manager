'use client'

import type { StrategyOption, TireCompound, TireState } from '@/types/race'
import { DegradationCurve } from '@/components/charts/degradation-curve'
import { colorForCompound } from '@/components/tire-roles'

interface DriverTireInfo {
  driverId: string
  driverName: string
  tireState: TireState | null
  wearHistory: number[]
  compoundHistory: TireCompound[]
}

interface TireStrategyProps {
  drivers: DriverTireInfo[]
  currentLap: number
  options: StrategyOption[]
  circuitCompounds: readonly TireCompound[]
  onSelectStrategy?: (option: StrategyOption) => void
  className?: string
}

/** Map a tire compound to a Broadcast compound letter. */
function compoundLetter(compound: string): string {
  const c = compound.trim().toUpperCase()
  if (c === 'S' || c.startsWith('SOFT')) return 'S'
  if (c === 'M' || c.startsWith('MED')) return 'M'
  if (c === 'H' || c.startsWith('HARD')) return 'H'
  if (c === 'I' || c.startsWith('INT')) return 'I'
  if (c === 'W' || c.startsWith('WET')) return 'W'
  return c.charAt(0)
}

/** CSS color-class for a compound letter (Broadcast tokens). */
function compoundColorClass(letter: string): string {
  if (letter === 'S') return 'text-c-soft'
  if (letter === 'M') return 'text-c-med'
  if (letter === 'H') return 'text-c-hard'
  if (letter === 'I') return 'text-c-inter'
  if (letter === 'W') return 'text-c-wet'
  return 'text-ink-mute'
}

/** Border color class for the 56-px tire ring. */
function compoundBorderClass(letter: string): string {
  if (letter === 'S') return 'border-c-soft'
  if (letter === 'M') return 'border-c-med'
  if (letter === 'H') return 'border-c-hard'
  if (letter === 'I') return 'border-c-inter'
  if (letter === 'W') return 'border-c-wet'
  return 'border-line-sub'
}

export function TireStrategy({ drivers, currentLap, options, circuitCompounds, onSelectStrategy, className = '' }: TireStrategyProps) {
  const pitWindow = options.length >= 3
    ? [options[0].pitLap, options[2].pitLap] as [number, number]
    : undefined

  return (
    <div className={`flex flex-col bg-surface-paper border border-line-sub rounded-rad overflow-hidden ${className}`}>
      {/* Panel header */}
      <div className="px-3 py-2 border-b border-line-sub">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-dim">
          Tire Strategy
        </span>
      </div>

      {/* Two-column driver grid separated by a 1-px line-hair line */}
      <div
        className="grid bg-line-hair"
        style={{ gridTemplateColumns: '1fr 1fr', gap: '1px' }}
      >
        {drivers.map((d) => {
          const ts = d.tireState
          if (!ts) {
            return (
              <div key={d.driverId} className="bg-surface-paper p-3.5 flex items-center justify-center">
                <span className="font-mono text-[10px] text-ink-dim">No data</span>
              </div>
            )
          }

          const letter = compoundLetter(ts.compound)
          const colorCls = compoundColorClass(letter)
          const borderCls = compoundBorderClass(letter)

          // Find the driver's position in the timing if available (not in props — show lap count instead)
          return (
            <div
              key={d.driverId}
              className="relative bg-surface-paper pl-4 pr-3.5 py-3.5 flex flex-col gap-2.5 overflow-hidden"
            >
              {/* Team-color left bar — use compound color as fallback since team isn't passed here */}
              <span
                className="absolute left-0 top-0 bottom-0 w-[3px]"
                style={{ backgroundColor: colorForCompound(ts.compound, circuitCompounds) }}
              />

              {/* Driver name + position */}
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-[15px] text-ink-hi uppercase tracking-[0.01em] truncate">
                  {d.driverName}
                </span>
              </div>

              {/* Tire ring + stats */}
              <div className="flex gap-3 items-center">
                {/* 56-px compound ring */}
                <div
                  className={`shrink-0 w-14 h-14 rounded-full border-[6px] ${borderCls} ${colorCls} grid place-items-center font-display font-extrabold text-[18px]`}
                  style={{ background: 'radial-gradient(circle, oklch(0.08 0 0) 30%, transparent 70%)' }}
                >
                  {letter}
                </div>

                {/* Stat rows */}
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-ink-dim uppercase tracking-[0.1em]">AGE</span>
                    <span className="text-ink-hi font-semibold tabular-nums">{ts.lapsFitted} laps</span>
                  </div>
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-ink-dim uppercase tracking-[0.1em]">WEAR</span>
                    <span className="text-ink-hi font-semibold tabular-nums">{Math.round(ts.wear)}%</span>
                  </div>
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-ink-dim uppercase tracking-[0.1em]">COMPOUND</span>
                    <span className={`font-semibold tabular-nums ${colorCls}`}>{ts.label}</span>
                  </div>
                </div>
              </div>

              {/* Wear bar — gradient green → amber → red */}
              <div className="h-[5px] bg-surface-void rounded-[1px] overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: `${ts.wear}%`,
                    background: 'linear-gradient(90deg, var(--sig-green) 0%, var(--sig-amber) 60%, var(--sig-red) 90%)',
                    transition: 'width 0.6s ease',
                  }}
                />
              </div>

              {/* Cliff zone warning */}
              {ts.wear < 20 && (
                <span className="font-mono text-[9px] text-sig-red uppercase tracking-[0.1em]">
                  CLIFF ZONE
                </span>
              )}

              {/* Degradation curve */}
              {d.wearHistory.length > 1 && (
                <DegradationCurve
                  wearData={d.wearHistory}
                  compoundData={d.compoundHistory}
                  circuitCompounds={circuitCompounds}
                  currentLap={currentLap}
                  pitWindow={pitWindow}
                  compoundLabel={ts.label}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Strategy / pit options */}
      {options.length > 0 && (
        <div className="flex flex-col border-t border-line-sub">
          <div className="px-3 py-2 border-b border-line-hair">
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-dim">
              Pit Options
            </span>
          </div>
          <div className="flex flex-col gap-px bg-line-hair">
            {options.map((opt) => (
              <button
                key={opt.type}
                type="button"
                onClick={() => onSelectStrategy?.(opt)}
                className="
                  bg-surface-paper px-3 py-2.5 text-left
                  hover:bg-surface-raised
                  transition-[background] duration-[120ms]
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sig-red/50
                "
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em] font-bold text-ink-hi">
                    {opt.type}
                  </span>
                  <span className="font-mono text-[10px] text-ink-mute">
                    Lap {opt.pitLap} → {opt.newCompound}
                  </span>
                </div>
                <p className="font-body text-[11px] text-ink-body mb-1">{opt.projectedOutcome}</p>
                <div className="flex justify-between font-mono text-[9px]">
                  <span className="text-sig-green font-bold">{Math.round(opt.probability * 100)}%</span>
                  <span className="text-ink-dim uppercase tracking-[0.1em]">{opt.risk}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
