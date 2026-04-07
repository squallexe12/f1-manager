'use client'

import type { StrategyOption, TireState } from '@/types/race'
import { DegradationCurve } from '@/components/charts/degradation-curve'
import { Badge } from '@/components/ui/badge'

interface DriverTireInfo {
  driverId: string
  driverName: string
  tireState: TireState | null
  wearHistory: number[]
}

interface TireStrategyProps {
  drivers: DriverTireInfo[]
  currentLap: number
  options: StrategyOption[]
  onSelectStrategy?: (option: StrategyOption) => void
  className?: string
}

const STRATEGY_BADGES: Record<string, 'lime' | 'cyan' | 'amber'> = {
  undercut: 'lime',
  optimum: 'cyan',
  overcut: 'amber',
}

const COMPOUND_COLORS: Record<string, string> = {
  C1: '#FFFFFF', C2: '#FFC800', C3: '#FF3B30', C4: '#FF3B30', C5: '#FF3B30',
}

export function TireStrategy({ drivers, currentLap, options, onSelectStrategy, className = '' }: TireStrategyProps) {
  const pitWindow = options.length >= 3
    ? [options[0].pitLap, options[2].pitLap] as [number, number]
    : undefined

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)]">
        Tire Strategy
      </h3>

      {/* Both drivers tire status */}
      <div className="flex flex-col gap-3">
        {drivers.map((d) => {
          const ts = d.tireState
          if (!ts) return null
          const wearColor = ts.wear > 50 ? 'var(--accent-lime)' : ts.wear > 25 ? 'var(--accent-amber)' : 'var(--accent-red)'

          return (
            <div key={d.driverId} className="bg-white/[0.02] rounded-md p-2">
              {/* Driver name + compound */}
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-heading font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  {d.driverName}
                </span>
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: COMPOUND_COLORS[ts.compound] ?? '#888' }}
                  />
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">{ts.compound}</span>
                </div>
              </div>

              {/* Wear bar */}
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-2 bg-white/[0.04] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${ts.wear}%`, backgroundColor: wearColor }}
                  />
                </div>
                <span className="text-[10px] font-mono w-8 text-right" style={{ color: wearColor }}>
                  {Math.round(ts.wear)}%
                </span>
              </div>

              {/* Stats row */}
              <div className="flex gap-3 text-[9px] font-mono text-[var(--text-dim)]">
                <span>Lap {ts.lapsFitted}</span>
                <span>{ts.label}</span>
                {ts.wear < 20 && <span className="text-[var(--accent-red)]">CLIFF ZONE</span>}
              </div>

              {/* Degradation curve */}
              {d.wearHistory.length > 1 && (
                <DegradationCurve
                  wearData={d.wearHistory}
                  currentLap={currentLap}
                  pitWindow={pitWindow}
                  compoundLabel={ts.label}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Strategy Options */}
      {options.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-heading uppercase tracking-wider text-[var(--text-dim)]">
            Pit Options
          </span>
          {options.map((opt) => (
            <button
              key={opt.type}
              onClick={() => onSelectStrategy?.(opt)}
              className="
                bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-2.5
                text-left hover:border-[var(--border-hover)] transition-colors duration-150
                focus-visible:ring-2 focus-visible:ring-[var(--accent-lime)]/50 outline-none
              "
            >
              <div className="flex items-center justify-between mb-0.5">
                <Badge variant={STRATEGY_BADGES[opt.type] ?? 'neutral'}>
                  {opt.type}
                </Badge>
                <span className="text-[10px] font-mono text-[var(--text-muted)]">
                  Lap {opt.pitLap} → {opt.newCompound}
                </span>
              </div>
              <p className="text-[10px] text-[var(--text-secondary)] mb-0.5">{opt.projectedOutcome}</p>
              <div className="flex justify-between text-[9px]">
                <span className="text-[var(--accent-lime)] font-mono">{Math.round(opt.probability * 100)}%</span>
                <span className="text-[var(--text-dim)]">{opt.risk}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
