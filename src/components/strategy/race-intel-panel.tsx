'use client'

import type { Circuit } from '@/types/race'
import type { CalibrationProfile } from '@/types/calibration'
import { deriveRaceIntel } from '@/engine/race/race-intel'
import { Badge } from '@/components/ui/badge'

interface RaceIntelPanelProps {
  circuit: Circuit
  calibration: CalibrationProfile
  className?: string
}

const COMPOUND_LABEL: Record<number, string> = { 0: 'HARD', 1: 'MEDIUM', 2: 'SOFT' }

/**
 * Pre-race intelligence panel (IP-07 Task 5).
 *
 * Renders OpenF1-derived hints — expected stint laps, pit-loss range, overtake
 * difficulty, weather outlook — above the rest of the pre-race surface. When
 * no OpenF1 data is available, the panel badges the content as "Fallback" so
 * the player knows they're reading derived heuristics rather than live telemetry.
 */
export function RaceIntelPanel({ circuit, calibration, className = '' }: RaceIntelPanelProps) {
  const intel = deriveRaceIntel(calibration, circuit)
  const isOpenF1 = intel.dataSource === 'openf1'

  return (
    <div
      className={`bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4 ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)]">
          Race Intelligence
        </h3>
        <Badge variant={isOpenF1 ? 'lime' : 'neutral'}>
          {isOpenF1 ? 'OpenF1 · 2024' : `${intel.dataSource.toUpperCase()}`}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Expected stint laps */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] mb-2">
            Expected Stint Length
          </div>
          <div className="flex gap-2">
            {circuit.compounds.map((c, i) => {
              const laps = intel.expectedStintLaps[c]
              return (
                <div
                  key={c}
                  className="flex-1 border border-[var(--border-default)] rounded-md px-2 py-1.5 text-center"
                >
                  <div className="text-[9px] font-mono text-[var(--text-dim)]">
                    {COMPOUND_LABEL[i] ?? ''} · {c}
                  </div>
                  <div className="text-sm font-heading font-semibold text-[var(--text-primary)]">
                    {laps != null ? `${laps} laps` : '—'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Pit loss range */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] mb-2">
            Pit-Lane Loss
          </div>
          <div className="border border-[var(--border-default)] rounded-md px-3 py-2">
            <div className="text-sm font-heading font-semibold text-[var(--text-primary)]">
              ~{intel.pitLossRangeSec.mean.toFixed(1)}s
            </div>
            <div className="text-[10px] font-mono text-[var(--text-dim)]">
              range {intel.pitLossRangeSec.low.toFixed(1)}s – {intel.pitLossRangeSec.high.toFixed(1)}s
            </div>
          </div>
        </div>

        {/* Overtake */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] mb-2">
            Overtake Opportunity
          </div>
          <div className="border border-[var(--border-default)] rounded-md px-3 py-2 text-[11px] text-[var(--text-secondary)]">
            {intel.overtakeHint}
          </div>
        </div>

        {/* Weather outlook */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] mb-2">
            Weather Outlook
          </div>
          <div className="border border-[var(--border-default)] rounded-md px-3 py-2 text-[11px] text-[var(--text-secondary)]">
            {intel.weatherOutlook}
          </div>
        </div>
      </div>
    </div>
  )
}
