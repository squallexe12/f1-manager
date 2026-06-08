'use client'

import type { TireCompound } from '@/types/race'

interface QualiDriverCommandsProps {
  driverId: string
  /** A code like 'NOR'. */
  driverName: string
  /** Currently selected run compound (null until the player picks one). */
  compound: TireCompound | null
  /** Circuit's 3 compounds, hardest → softest (positional roles). */
  circuitCompounds: TireCompound[]
  setsByCompound: Partial<Record<TireCompound, number>>
  sessionPhase: 'idle' | 'running' | 'paused' | 'segment-end' | 'finished'
  onSelectTire: (driverId: string, compound: TireCompound) => void
  onSendLap: (driverId: string) => void
  onAbortLap: (driverId: string) => void
  className?: string
}

const ROLE_LABEL = ['HARD', 'MED', 'SOFT']
const ROLE_DOT = ['text-c-hard', 'text-c-med', 'text-c-soft']

/**
 * Per-player-driver qualifying control panel (plan §M7) — a sibling of
 * `PracticeDriverCommands`. The run compound is chosen BEFORE a segment (it
 * depletes the weekend tire-set ledger) and locks once the lap is live; SEND
 * LAP / ABORT are live-only theatrical nudges (hot-lap results are pre-computed
 * deterministically by the knockout engine).
 */
export function QualiDriverCommands({
  driverId,
  driverName,
  compound,
  circuitCompounds,
  setsByCompound,
  sessionPhase,
  onSelectTire,
  onSendLap,
  onAbortLap,
  className = '',
}: QualiDriverCommandsProps) {
  const isRunning = sessionPhase === 'running'

  return (
    <div className={`flex flex-col gap-2.5 bg-surface-paper border border-line-sub rounded-rad p-3 ${className}`}>
      <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-dim">{driverName}</span>

      {/* TIRE — locked once the lap is live */}
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
                disabled={isRunning || out}
                onClick={() => onSelectTire(driverId, c)}
                className={[
                  'flex items-center gap-1.5 px-2 py-1 rounded-rad border',
                  'font-mono text-[9px] font-bold uppercase tracking-[0.08em]',
                  'outline-none focus-visible:ring-2 focus-visible:ring-sig-red/50',
                  'transition-[background,border-color] duration-[120ms]',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                  active
                    ? 'bg-surface-raised border-[var(--accent-cyan)] text-ink-hi'
                    : 'bg-surface-raised border-line-hair text-ink-mute enabled:hover:bg-surface-hi enabled:hover:text-ink-hi enabled:active:scale-[0.97]',
                ].join(' ')}
              >
                <span className={`text-[12px] leading-none ${active ? 'text-[var(--accent-cyan)]' : ROLE_DOT[i] ?? ''}`} aria-hidden>
                  ●
                </span>
                {ROLE_LABEL[i] ?? c}
                <span className="tabular-nums opacity-70">×{sets}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Live nudges — only while a hot lap is running */}
      <div className="flex gap-1.5 border-t border-line-hair pt-2">
        <button
          type="button"
          disabled={!isRunning}
          onClick={() => onSendLap(driverId)}
          className={[
            'flex-1 px-2 py-1.5 rounded-rad border font-mono text-[9px] font-bold uppercase tracking-[0.12em]',
            'outline-none focus-visible:ring-2 focus-visible:ring-sig-red/50',
            'transition-[background,border-color,transform] duration-[120ms]',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'bg-sig-green/15 border-sig-green/40 text-sig-green enabled:hover:bg-sig-green/25 enabled:active:scale-[0.98]',
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
            'transition-[background,border-color,transform] duration-[120ms]',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'bg-surface-raised border-line-hair text-ink-mute enabled:hover:bg-surface-hi enabled:hover:text-ink-hi enabled:active:scale-[0.98]',
          ].join(' ')}
        >
          Abort
        </button>
      </div>
    </div>
  )
}
