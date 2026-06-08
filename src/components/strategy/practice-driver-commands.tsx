'use client'

import type { TireCompound } from '@/types/race'
import type { PracticeProgram } from '@/types/weekend'
import type { PracticeStatus } from '@/stores/practice-runtime-slice'
import { PRACTICE_PROGRAM_META, PRACTICE_PROGRAM_ORDER } from './practice-program-meta'

interface PracticeDriverCommandsProps {
  driverId: string
  driverName: string
  program: PracticeProgram | null
  compound: TireCompound | null
  /** Circuit's 3 compounds, hardest → softest (positional roles). */
  circuitCompounds: TireCompound[]
  setsByCompound: Partial<Record<TireCompound, number>>
  status: PracticeStatus
  onSelectRunPlan: (driverId: string, program: PracticeProgram) => void
  onSelectTire: (driverId: string, compound: TireCompound) => void
  onSendLap: (driverId: string) => void
  onAbortLap: (driverId: string) => void
  className?: string
}

const ROLE_LABEL = ['HARD', 'MEDIUM', 'SOFT']
const ROLE_DOT = ['text-c-hard', 'text-c-med', 'text-c-soft']

/**
 * Per-driver practice control panel (plan §M5) — a new component, not a fork of
 * the race `DriverCommands`. RUN PLAN + TIRE are chosen in the PLAN phase
 * (disabled once the session is live); SEND LAP / ABORT are live-only theatrical
 * nudges (results are pre-computed deterministically).
 */
export function PracticeDriverCommands({
  driverId,
  driverName,
  program,
  compound,
  circuitCompounds,
  setsByCompound,
  status,
  onSelectRunPlan,
  onSelectTire,
  onSendLap,
  onAbortLap,
  className = '',
}: PracticeDriverCommandsProps) {
  const isIdle = status === 'idle'
  const isRunning = status === 'running'

  return (
    <div className={`flex flex-col gap-2.5 bg-surface-paper border border-line-sub rounded-rad p-3 ${className}`}>
      <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-dim">{driverName}</span>

      {/* RUN PLAN */}
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-ink-dim">Run Plan</span>
        <div className="grid grid-cols-4 gap-1">
          {PRACTICE_PROGRAM_ORDER.map((p) => {
            const meta = PRACTICE_PROGRAM_META[p]
            const active = program === p
            return (
              <button
                key={p}
                type="button"
                aria-pressed={active}
                aria-label={`${meta.label} — ${meta.timeMins} min, ${meta.sets} set${meta.sets > 1 ? 's' : ''}`}
                disabled={!isIdle}
                onClick={() => onSelectRunPlan(driverId, p)}
                className={[
                  'flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-rad border',
                  'font-mono text-[8px] font-semibold uppercase tracking-[0.08em]',
                  'outline-none focus-visible:ring-2 focus-visible:ring-sig-red/50',
                  'transition-[background,border-color,color] duration-[120ms]',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                  active
                    ? 'bg-sig-red border-sig-red text-white'
                    : 'bg-surface-raised border-line-hair text-ink-mute enabled:hover:bg-surface-hi enabled:hover:text-ink-hi',
                ].join(' ')}
              >
                <span className="font-display text-[13px] leading-none">{meta.icon}</span>
                <span>{meta.label.split(' ')[0]}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* TIRE */}
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-ink-dim">Tire</span>
        <div className="flex gap-1">
          {circuitCompounds.map((c, i) => {
            const sets = setsByCompound[c] ?? 0
            const active = compound === c
            const out = sets <= 0
            return (
              <button
                key={c}
                type="button"
                aria-pressed={active}
                aria-label={`${ROLE_LABEL[i] ?? c} compound, ${sets} sets remaining`}
                disabled={!isIdle || out}
                onClick={() => onSelectTire(driverId, c)}
                className={[
                  'flex items-center gap-1.5 px-2 py-1 rounded-rad border',
                  'font-mono text-[9px] font-bold uppercase tracking-[0.08em]',
                  'outline-none focus-visible:ring-2 focus-visible:ring-sig-red/50',
                  'transition-[background,border-color] duration-[120ms]',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                  active
                    ? 'bg-ink-hi border-ink-hi text-surface-void'
                    : 'bg-surface-raised border-line-hair text-ink-mute enabled:hover:bg-surface-hi',
                ].join(' ')}
              >
                <span className={`text-[12px] leading-none ${active ? '' : ROLE_DOT[i] ?? ''}`} aria-hidden>●</span>
                {ROLE_LABEL[i] ?? c}
                <span className="tabular-nums opacity-70">×{sets}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Live nudges */}
      <div className="flex gap-1.5 border-t border-line-hair pt-2">
        <button
          type="button"
          disabled={!isRunning}
          onClick={() => onSendLap(driverId)}
          className={[
            'flex-1 px-2 py-1.5 rounded-rad border font-mono text-[9px] font-bold uppercase tracking-[0.12em]',
            'outline-none focus-visible:ring-2 focus-visible:ring-sig-red/50',
            'transition-[background,border-color] duration-[120ms]',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'bg-sig-green/15 border-sig-green/40 text-sig-green enabled:hover:bg-sig-green/25',
          ].join(' ')}
        >
          Send Lap
        </button>
        <button
          type="button"
          disabled={!isRunning}
          onClick={() => onAbortLap(driverId)}
          className={[
            'flex-1 px-2 py-1.5 rounded-rad border font-mono text-[9px] font-bold uppercase tracking-[0.12em]',
            'outline-none focus-visible:ring-2 focus-visible:ring-sig-red/50',
            'transition-[background,border-color] duration-[120ms]',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'bg-surface-raised border-line-hair text-ink-mute enabled:hover:bg-surface-hi enabled:hover:text-ink-hi',
          ].join(' ')}
        >
          Abort
        </button>
      </div>
    </div>
  )
}
