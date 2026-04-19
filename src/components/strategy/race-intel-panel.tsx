'use client'

import type { Circuit } from '@/types/race'
import type { CalibrationProfile } from '@/types/calibration'
import { deriveRaceIntel } from '@/engine/race/race-intel'

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
    <div className={`rounded-rad border border-line-sub bg-surface-paper overflow-hidden ${className}`}>
      {/* .panel-head */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-line-hair bg-surface-raised">
        <div className="flex items-center gap-2">
          {isOpenF1 && (
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-sig-red"
              style={{ boxShadow: '0 0 8px var(--sig-red)' }}
              aria-hidden
            />
          )}
          <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-ink-hi font-semibold">
            Race Intelligence
          </span>
        </div>
        <span
          className={[
            'font-mono text-[9px] tracking-[0.14em] uppercase font-bold px-2 py-0.5 rounded-[2px] border',
            isOpenF1
              ? 'text-sig-green border-sig-green/50 bg-sig-green/10'
              : 'text-ink-dim border-line-sub bg-surface-raised',
          ].join(' ')}
        >
          {isOpenF1 ? 'OpenF1 · 2024' : intel.dataSource.toUpperCase()}
        </span>
      </div>

      {/* .panel-body — 2×2 .w-cell grid */}
      <div
        className="grid grid-cols-2"
        style={{ gap: '1px', background: 'var(--line-hair)' }}
      >
        {/* Expected stint laps */}
        <div className="bg-surface-paper px-3.5 py-2.5 flex flex-col gap-1.5 col-span-2">
          <div className="font-mono text-[9px] tracking-[0.14em] text-ink-dim uppercase">
            Expected Stint Length
          </div>
          <div className="flex gap-2">
            {circuit.compounds.map((c, i) => {
              const laps = intel.expectedStintLaps[c]
              return (
                <div
                  key={c}
                  className="flex-1 border border-line-hair rounded-rad px-2 py-1.5 text-center bg-surface-raised"
                >
                  <div className="font-mono text-[9px] text-ink-dim">
                    {COMPOUND_LABEL[i] ?? ''} · {c}
                  </div>
                  <div className="font-mono font-bold text-[16px] text-ink-hi tabular-nums">
                    {laps != null ? `${laps}` : '—'}
                    <span className="text-ink-dim font-normal text-[11px] ml-1">laps</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Pit-lane loss — .w-cell */}
        <div className="bg-surface-paper px-3.5 py-2.5 flex flex-col gap-1">
          <div className="font-mono text-[9px] tracking-[0.14em] text-ink-dim uppercase">
            Pit-Lane Loss
          </div>
          <div className="font-mono font-bold text-[16px] text-ink-hi" style={{ fontVariantNumeric: 'tabular-nums' }}>
            ~{intel.pitLossRangeSec.mean.toFixed(1)}
            <span className="text-ink-dim font-normal text-[11px] ml-1">s</span>
          </div>
          <div className="font-mono text-[9px] text-ink-dim">
            {intel.pitLossRangeSec.low.toFixed(1)}s – {intel.pitLossRangeSec.high.toFixed(1)}s range
          </div>
        </div>

        {/* Overtake opportunity — .w-cell */}
        <div className="bg-surface-paper px-3.5 py-2.5 flex flex-col gap-1">
          <div className="font-mono text-[9px] tracking-[0.14em] text-ink-dim uppercase">
            Overtake Opportunity
          </div>
          <div className="font-mono text-[11px] text-ink-body leading-relaxed">
            {intel.overtakeHint}
          </div>
        </div>

        {/* Weather outlook — .w-cell (full width) */}
        <div className="bg-surface-paper px-3.5 py-2.5 flex flex-col gap-1 col-span-2">
          <div className="font-mono text-[9px] tracking-[0.14em] text-ink-dim uppercase">
            Weather Outlook
          </div>
          <div className="font-mono text-[11px] text-ink-body leading-relaxed">
            {intel.weatherOutlook}
          </div>
        </div>
      </div>
    </div>
  )
}
