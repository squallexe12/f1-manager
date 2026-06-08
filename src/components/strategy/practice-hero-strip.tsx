'use client'

import { formatClock } from '@/lib/utils/format'

interface PracticeHeroStripProps {
  timeRemaining: number
  timeBudget: number
  /** Driver leading the session by setup confidence; null → '—' (no FP run yet). */
  leader: { code: string; teamColor: string; setupConfidence: number } | null
  setsRemaining: number
  className?: string
}

/**
 * Practice hero strip (plan §M5). The race hero's "fastest lap / gap" has no
 * analogue in practice — the engine produces no timed practice laps — so the
 * three cards surface practice's real signals: the session clock, the setup
 * leader, and the weekend tire-set reserve. The leader card shows '—' until an
 * FP has been run (mirrors the race hero's empty-state semantics).
 */
export function PracticeHeroStrip({
  timeRemaining,
  timeBudget,
  leader,
  setsRemaining,
  className = '',
}: PracticeHeroStripProps) {
  const pct = timeBudget > 0 ? (timeRemaining / timeBudget) * 100 : 0
  const lowReserve = setsRemaining <= 3

  return (
    <div
      className={`grid gap-3 mb-3 grid-cols-1 min-[900px]:grid-cols-3 ${className}`}
    >
      {/* Session clock */}
      <div className="relative overflow-hidden bg-surface-paper border border-line-sub rounded-rad p-4 flex flex-col gap-2">
        <span className="absolute top-0 left-0 bottom-0 w-1 bg-sig-red" />
        <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-dim">Session</div>
        <div className="font-display font-extrabold text-[48px] leading-[0.9] tracking-[-0.03em] text-ink-hi tabular-nums">
          {formatClock(timeRemaining)}
        </div>
        <div className="h-1 bg-surface-void rounded-[2px] overflow-hidden">
          <div className="h-full bg-sig-red rounded-[2px]" style={{ width: `${pct}%`, transition: 'width 300ms ease' }} />
        </div>
      </div>

      {/* Setup leader */}
      <div className="bg-surface-paper border border-line-sub rounded-rad p-4 flex flex-col gap-2 justify-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim">Setup Leader</div>
        {leader ? (
          <div className="flex items-baseline gap-3">
            <span className="w-1.5 h-7 rounded-[1px]" style={{ backgroundColor: leader.teamColor }} aria-hidden />
            <span className="font-display font-extrabold text-[34px] text-ink-hi tracking-[-0.02em] leading-none">
              {leader.code}
            </span>
            <span className="ml-auto font-display font-bold text-[28px] tabular-nums leading-none" style={{ color: 'var(--accent-lime)' }}>
              {Math.round(leader.setupConfidence)}
            </span>
          </div>
        ) : (
          <div className="font-display font-extrabold text-[34px] text-ink-dim tracking-[-0.02em] leading-none">—</div>
        )}
      </div>

      {/* Tire reserve */}
      <div className="bg-surface-paper border border-line-sub rounded-rad p-4 flex flex-col gap-1.5 justify-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim">Tire Reserve</div>
        <div
          className="font-display font-bold text-[38px] tracking-[-0.03em] leading-none tabular-nums"
          aria-label={`${setsRemaining} tire sets remaining${lowReserve ? ' (low)' : ''}`}
        >
          <span className={lowReserve ? 'text-sig-amber' : 'text-ink-hi'}>{setsRemaining}</span>
          {lowReserve && (
            <span className="ml-2 align-middle font-mono text-[10px] text-sig-amber tracking-[0.14em]">LOW</span>
          )}
        </div>
        <div className="font-mono text-[10px] tracking-[0.1em] text-ink-mute uppercase">sets left</div>
      </div>
    </div>
  )
}
