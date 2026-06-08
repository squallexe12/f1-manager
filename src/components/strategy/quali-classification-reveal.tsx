'use client'

import { motion } from 'framer-motion'

interface QualiClassificationRow {
  position: number
  driverId: string
  code: string
  driverName: string
  teamColor: string
  isPlayer: boolean
  bestTime: number | null
  isPole: boolean
  isFastest: boolean
}

interface QualiClassificationRevealProps {
  rows: QualiClassificationRow[]
  pole: { code: string; time: number | null } | null
  fastest: { code: string; time: number } | null
  /** Switches the heading to the sprint-qualifying variant. */
  isSprint?: boolean
  onConfirm: () => void
}

/** Copied from timing-tower.tsx — keep the session's lap-time formatting consistent. */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toFixed(3).padStart(6, '0')}`
}

/**
 * Final earned-grid reveal shown when qualifying finishes (plan §M7). A staggered
 * P1..PN list with the pole row in the lime accent, a pole + fastest-lap callout
 * strip, and a "Confirm Grid" CTA that hands the earned grid off to the race.
 *
 * Presentational only — all data + the confirm callback arrive via props.
 */
export function QualiClassificationReveal({
  rows,
  pole,
  fastest,
  isSprint = false,
  onConfirm,
}: QualiClassificationRevealProps) {
  const heading = isSprint ? 'SPRINT QUALIFYING RESULT' : 'QUALIFYING RESULT'

  return (
    <div className="flex flex-col gap-4 bg-surface-paper border border-line-sub rounded-rad p-6">
      {/* Heading */}
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[11px] tracking-[0.3em] text-sig-red font-bold uppercase">
          <span aria-hidden="true">◆ </span>EARNED GRID
        </span>
        <h2
          className="font-display font-extrabold text-ink-hi uppercase leading-none"
          style={{ fontSize: '36px', letterSpacing: '-0.03em' }}
        >
          {heading}
        </h2>
      </div>

      {/* Pole + Fastest callout strip */}
      {(pole || fastest) && (
        <div className="flex flex-wrap gap-3">
          {pole && (
            <div className="flex items-baseline gap-2 bg-surface-raised border border-line-hair rounded-rad px-4 py-2.5">
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--accent-lime)] font-bold">
                POLE
              </span>
              <span className="font-display font-bold text-[18px] text-[var(--accent-lime)] tracking-[-0.01em] leading-none">
                {pole.code}
              </span>
              <span className="font-mono text-[13px] text-ink-body tabular-nums">
                {pole.time != null ? formatTime(pole.time) : 'NO TIME'}
              </span>
            </div>
          )}
          {fastest && (
            <div className="flex items-baseline gap-2 bg-surface-raised border border-line-hair rounded-rad px-4 py-2.5">
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--accent-cyan)] font-bold">
                FASTEST
              </span>
              <span className="font-display font-bold text-[18px] text-[var(--accent-cyan)] tracking-[-0.01em] leading-none">
                {fastest.code}
              </span>
              <span className="font-mono text-[13px] text-ink-body tabular-nums">
                {formatTime(fastest.time)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Grid rows P1..PN */}
      <div
        className="flex flex-col font-mono text-[12px] bg-surface-void border border-line-sub rounded-rad overflow-hidden"
        role="table"
        aria-label="Qualifying classification"
      >
        {/* Header rowgroup */}
        <div role="rowgroup" className="contents">
          <div
            className="grid gap-2 px-3 py-1.5 border-b border-line-sub text-[9px] uppercase tracking-[0.14em] text-ink-dim"
            style={{ gridTemplateColumns: '32px 8px 56px 1fr 84px' }}
            role="row"
          >
            <span role="columnheader" className="text-right">POS</span>
            <span role="columnheader"><span className="sr-only">Team</span></span>
            <span role="columnheader">CODE</span>
            <span role="columnheader">DRIVER</span>
            <span role="columnheader" className="text-right">TIME</span>
          </div>
        </div>

        {/* Body rowgroup */}
        <div role="rowgroup" className="contents">
        {rows.map((row, index) => (
          <motion.div
            key={row.driverId}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.04, ease: 'easeOut' }}
            role="row"
            aria-label={`P${row.position} ${row.driverName}${row.isPole ? ' (pole)' : ''}${row.isFastest ? ' (fastest lap)' : ''}`}
            className={`
              relative grid gap-2 px-3 py-[7px] border-b border-line-hair items-center
              transition-[background] duration-[120ms]
              ${row.isPlayer ? 'bg-[oklch(0.20_0.03_25_/_0.35)]' : 'hover:bg-surface-raised'}
            `}
            style={{ gridTemplateColumns: '32px 8px 56px 1fr 84px' }}
          >
            {/* Player indicator bar */}
            {row.isPlayer && (
              <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-sig-red" />
            )}

            {/* POS */}
            <span
              className={`text-right font-display font-bold text-[18px] leading-none tabular-nums tracking-[-0.02em] ${
                row.isPole ? 'text-[var(--accent-lime)]' : 'text-ink-hi'
              }`}
            >
              {row.position}
            </span>

            {/* Team bar */}
            <span
              className="w-[4px] h-[22px] rounded-[1px] shrink-0"
              style={{ backgroundColor: row.teamColor }}
            />

            {/* Driver code */}
            <span
              className={`flex items-center gap-1.5 font-display font-bold text-[13px] tracking-[0.02em] uppercase truncate ${
                row.isPole ? 'text-[var(--accent-lime)]' : 'text-ink-hi'
              }`}
            >
              {row.code}
              {row.isFastest && (
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0 bg-[var(--accent-cyan)]"
                  aria-hidden="true"
                />
              )}
            </span>

            {/* Driver name */}
            <span className="font-body text-[10px] text-ink-dim tracking-[0.02em] truncate">
              {row.driverName}
            </span>

            {/* Best time */}
            <span
              className={`text-right text-[11px] tabular-nums ${
                row.bestTime != null ? 'text-ink-body' : 'text-ink-dim'
              }`}
            >
              {row.bestTime != null ? formatTime(row.bestTime) : 'NO TIME'}
            </span>
          </motion.div>
        ))}
        </div>
      </div>

      {/* Confirm Grid CTA */}
      <button
        type="button"
        onClick={onConfirm}
        className="w-full flex items-center justify-center gap-2 px-4 py-3
                   bg-sig-red text-ink-hi font-mono font-bold text-[12px]
                   tracking-[0.12em] uppercase rounded-rad outline-none
                   hover:opacity-90 focus-visible:ring-2 focus-visible:ring-sig-red
                   focus-visible:ring-offset-2 focus-visible:ring-offset-surface-paper
                   active:scale-[0.98]"
        style={{ transition: 'opacity 150ms ease, transform 100ms ease' }}
      >
        CONFIRM GRID
        <span aria-hidden>→</span>
      </button>
    </div>
  )
}
