'use client'

import { SimSpeedControl } from './sim-speed-control'
import { RaceTicker } from './race-ticker'
import { formatClock } from '@/lib/utils/format'
import type { CommentaryEntry, SimSpeed } from '@/types/race'

type QualiSessionPhase = 'idle' | 'running' | 'paused' | 'segment-end' | 'finished'

interface QualiBroadcastChromeProps {
  segmentLabel: string // "Q1"
  segmentName: string // "Qualifying 1"
  timeRemaining: number // seconds
  sessionPhase: QualiSessionPhase
  weather: 'dry' | 'damp' | 'wet' | string
  currentSpeed: SimSpeed
  onSetSpeed: (speed: SimSpeed) => void
  onPause: () => void
  onResume: () => void
  tickerEntries: CommentaryEntry[]
  sticky?: boolean
  className?: string
}

const STATUS_BADGE: Record<QualiSessionPhase, { icon: string; label: string; cls: string }> = {
  idle: { icon: '', label: 'STANDBY', cls: 'text-ink-dim' },
  running: { icon: '◉', label: 'LIVE', cls: 'text-sig-red' },
  paused: { icon: '⏸', label: 'PAUSED', cls: 'text-sig-amber' },
  'segment-end': { icon: '✓', label: 'SEGMENT', cls: 'text-sig-green' },
  finished: { icon: '✓', label: 'GRID SET', cls: 'text-sig-green' },
}

/**
 * Slim broadcast chrome for the qualifying screen (plan §M7). A SEPARATE wrapper
 * from the practice / race chrome — it does NOT widen the race `BroadcastChrome`
 * union. The status strip shows the SEGMENT + a COUNTDOWN clock + WEATHER (no lap
 * counter — qualifying has no laps), then reuses the race `SimSpeedControl` and
 * `RaceTicker` as-is.
 */
export function QualiBroadcastChrome({
  segmentLabel,
  segmentName,
  timeRemaining,
  sessionPhase,
  weather,
  currentSpeed,
  onSetSpeed,
  onPause,
  onResume,
  tickerEntries,
  sticky = true,
  className = '',
}: QualiBroadcastChromeProps) {
  const badge = STATUS_BADGE[sessionPhase]
  const isPaused = sessionPhase === 'paused'

  return (
    <div className={`${sticky ? 'sticky top-12 z-20 bg-surface-void/95 backdrop-blur-md pb-2 -mx-4 px-4 pt-1' : ''} ${className}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap bg-surface-paper border border-line-sub rounded-t-rad px-1 py-1">
        {/* No role="status" here: the countdown updates every reveal tick, and a
            polite live region would re-announce it many times/sec. The clock
            carries role="timer" (implicit aria-live="off"), and each stat has a
            visible label, so the bar is readable without screen-reader spam. */}
        <div className="flex items-center gap-6 bg-surface-paper border border-line-sub rounded-rad px-4 py-2">
          {/* Segment — replaces the race LAP counter */}
          <div className="flex flex-col gap-0.5 items-center">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-dim">Segment</span>
            <span className="font-mono font-semibold text-[14px] text-ink-hi">
              <span className="text-sig-red">{segmentLabel}</span>
              <span className="sr-only"> {segmentName}</span>
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

          {/* Weather */}
          <div className="flex flex-col gap-0.5 items-center">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-dim">Weather</span>
            <span className="font-mono font-semibold text-[11px] uppercase tracking-[0.1em] text-ink-body">
              {weather.toUpperCase()}
            </span>
          </div>

          <div className="w-px h-6 bg-line-hair" />

          {/* Live status */}
          <div className="flex flex-col gap-0.5 items-center">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-dim">Status</span>
            <span className={`font-mono font-semibold text-[11px] uppercase tracking-[0.1em] ${badge.cls}`}>
              {badge.icon && <span aria-hidden="true">{badge.icon} </span>}
              <span>{badge.label}</span>
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
      {/* Phase-transition announcement — the countdown's role="timer" mutes
          updates, so this sr-only live region conveys session-state changes to
          screen readers without per-tick clock spam. */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {sessionPhase === 'paused' ? 'Simulation paused'
          : sessionPhase === 'segment-end' ? `${segmentName} complete`
          : sessionPhase === 'finished' ? 'Qualifying complete, grid set'
          : ''}
      </div>
      <RaceTicker entries={tickerEntries} />
    </div>
  )
}
