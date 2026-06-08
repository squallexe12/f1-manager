'use client'

import { SimSpeedControl } from './sim-speed-control'
import { RaceTicker } from './race-ticker'
import { formatClock } from '@/lib/utils/format'
import type { CommentaryEntry, SimSpeed } from '@/types/race'
import type { PracticeStatus } from '@/stores/practice-runtime-slice'

interface PracticeBroadcastChromeProps {
  sessionLabel: string // "FP1"
  sessionName: string // "Free Practice 1"
  timeRemaining: number // seconds
  status: PracticeStatus
  currentSpeed: SimSpeed
  onSetSpeed: (speed: SimSpeed) => void
  onPause: () => void
  onResume: () => void
  tickerEntries: CommentaryEntry[]
  sticky?: boolean
  className?: string
}

const STATUS_BADGE: Record<PracticeStatus, { label: string; cls: string }> = {
  idle: { label: 'STANDBY', cls: 'text-ink-dim' },
  running: { label: '◉ LIVE', cls: 'text-sig-red' },
  paused: { label: '⏸ PAUSED', cls: 'text-sig-amber' },
  'session-end': { label: '✓ COMPLETE', cls: 'text-sig-green' },
}

/**
 * Slim broadcast chrome for the practice screen (plan §M5). Deliberately a
 * separate wrapper — it does NOT widen the race `BroadcastChrome` union. The
 * status strip shows the SESSION + a COUNTDOWN clock (no lap counter — practice
 * has no laps), then reuses the race `SimSpeedControl` and `RaceTicker` as-is.
 */
export function PracticeBroadcastChrome({
  sessionLabel,
  sessionName,
  timeRemaining,
  status,
  currentSpeed,
  onSetSpeed,
  onPause,
  onResume,
  tickerEntries,
  sticky = true,
  className = '',
}: PracticeBroadcastChromeProps) {
  const badge = STATUS_BADGE[status]
  const isPaused = status === 'paused'

  return (
    <div className={`${sticky ? 'sticky top-12 z-20 bg-surface-void/95 backdrop-blur-md pb-2 -mx-4 px-4 pt-1' : ''} ${className}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap bg-surface-paper border border-line-sub rounded-t-rad px-1 py-1">
        {/* No role="status" here: the countdown updates every reveal tick, and a
            polite live region would re-announce it many times/sec. The clock
            carries role="timer" (implicit aria-live="off"), and each stat has a
            visible label, so the bar is readable without screen-reader spam. */}
        <div className="flex items-center gap-6 bg-surface-paper border border-line-sub rounded-rad px-4 py-2">
          {/* Session — replaces the race LAP counter */}
          <div className="flex flex-col gap-0.5 items-center">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-dim">Session</span>
            <span className="font-mono font-semibold text-[14px] text-ink-hi">
              <span className="text-sig-red">{sessionLabel}</span>
              <span className="sr-only"> {sessionName}</span>
            </span>
          </div>

          <div className="w-px h-6 bg-line-hair" />

          {/* Countdown clock */}
          <div className="flex flex-col gap-0.5 items-center">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-dim">Time</span>
            <span
              className="font-mono font-semibold text-[14px] text-ink-hi tabular-nums"
              role="timer"
              aria-label={`Session time remaining ${formatClock(timeRemaining)}`}
            >
              {formatClock(timeRemaining)}
            </span>
          </div>

          <div className="w-px h-6 bg-line-hair" />

          {/* Live status */}
          <div className="flex flex-col gap-0.5 items-center">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-dim">Status</span>
            <span className={`font-mono font-semibold text-[11px] uppercase tracking-[0.1em] ${badge.cls}`}>
              {badge.label}
            </span>
          </div>
        </div>

        <SimSpeedControl
          currentSpeed={currentSpeed}
          onSetSpeed={onSetSpeed}
          onPause={onPause}
          onResume={onResume}
          isPaused={isPaused}
          className="pr-2"
        />
      </div>
      <RaceTicker entries={tickerEntries} />
    </div>
  )
}
