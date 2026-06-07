'use client'

import type { TireCompound } from '@/types/race'
import { formatClock } from '@/lib/utils/format'

interface TireSetRow {
  compound: TireCompound
  role: 'hard' | 'medium' | 'soft'
  setsRemaining: number
}

interface SessionBudgetMeterProps {
  /** Hidden in the PLAN phase — the tire ledger is shown by the driver tire
   *  picker there; this live meter only renders during a running/paused/ended
   *  session. */
  visible: boolean
  timeRemaining: number
  timeBudget: number
  ledger: TireSetRow[]
  /** Sets at or below this count flash a low-reserve warning. Default 1. */
  lowSetThreshold?: number
  className?: string
}

const ROLE_DOT: Record<TireSetRow['role'], string> = {
  hard: 'text-c-hard',
  medium: 'text-c-med',
  soft: 'text-c-soft',
}

/**
 * Live session budget (plan §M5): session clock + the weekend tire-SET ledger
 * per compound, with a low-reserve warning. Tire sets — not laps — are the
 * scarce weekend resource shared by practice and qualifying.
 */
export function SessionBudgetMeter({
  visible,
  timeRemaining,
  timeBudget,
  ledger,
  lowSetThreshold = 1,
  className = '',
}: SessionBudgetMeterProps) {
  if (!visible) return null
  const pct = timeBudget > 0 ? (timeRemaining / timeBudget) * 100 : 0

  return (
    <div
      className={`flex flex-col gap-3 bg-surface-paper border border-line-sub rounded-rad p-3 ${className}`}
    >
      {/* Session clock */}
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-dim">Session Time</span>
        <span
          className="font-display font-bold text-[20px] text-ink-hi tabular-nums leading-none"
          role="timer"
          aria-label={`Session time remaining ${formatClock(timeRemaining)}`}
        >
          {formatClock(timeRemaining)}
        </span>
      </div>
      <div className="h-1 bg-surface-void rounded-[2px] overflow-hidden">
        <div
          className="h-full bg-sig-red rounded-[2px]"
          style={{ width: `${pct}%`, transition: 'width 300ms ease' }}
        />
      </div>

      {/* Tire-set ledger */}
      <div className="flex flex-col gap-1.5 border-t border-line-hair pt-2.5">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-dim">Tire Sets</span>
        {ledger.map((row) => {
          const low = row.setsRemaining <= lowSetThreshold
          return (
            <div key={row.compound} className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className={`text-[13px] leading-none ${ROLE_DOT[row.role]}`} aria-hidden>●</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
                  {row.role}
                </span>
              </span>
              <span
                className={`font-mono text-[12px] font-bold tabular-nums ${low ? 'text-sig-amber' : 'text-ink-hi'}`}
                aria-label={`${row.role} sets remaining ${row.setsRemaining}${low ? ' (low)' : ''}`}
              >
                {row.setsRemaining}
                {low && <span className="ml-1.5 text-[8px] tracking-[0.14em]">LOW</span>}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
