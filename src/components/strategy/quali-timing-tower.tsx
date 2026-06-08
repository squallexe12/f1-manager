'use client'

import { Fragment } from 'react'
import { motion } from 'framer-motion'

interface QualiTowerEntry {
  position: number
  driverId: string
  code: string
  driverName: string
  teamColor: string
  isPlayer: boolean
  bestLapTime: number | null
  sectors: { s1: number; s2: number; s3: number } | null
  /** 'SOFT' | 'MED' | 'HARD' | '' */
  tire: string
  eliminated: boolean
  isBelowCutline: boolean
}

interface QualiTimingTowerProps {
  entries: QualiTowerEntry[]
  /** Position of the last surviving driver in this segment. 0 in the final segment (no cutline). */
  cutlinePosition: number
  className?: string
}

const GRID_COLUMNS = '32px 8px 48px 1fr 58px 58px 58px 70px 40px'

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toFixed(3).padStart(6, '0')}`
}

/** Sector split → "ss.mmm" (no minute component). */
function formatSector(seconds: number): string {
  return seconds.toFixed(3)
}

/** Map a tire compound token to a Broadcast compound colour class. */
function tireColorClass(tire: string): string {
  const t = tire.trim().toUpperCase()
  if (t === 'S' || t.startsWith('SOFT')) return 'text-c-soft'
  if (t === 'M' || t.startsWith('MED')) return 'text-c-med'
  if (t === 'H' || t.startsWith('HARD')) return 'text-c-hard'
  if (t === 'I' || t.startsWith('INT')) return 'text-c-inter'
  if (t === 'W' || t.startsWith('WET')) return 'text-c-wet'
  return 'text-ink-mute'
}

function tireLetter(tire: string): string {
  const t = tire.trim().toUpperCase()
  if (t.startsWith('SOFT')) return 'S'
  if (t.startsWith('MED')) return 'M'
  if (t.startsWith('HARD')) return 'H'
  if (t.startsWith('INT')) return 'I'
  if (t.startsWith('WET')) return 'W'
  return t.charAt(0)
}

/**
 * Knockout qualifying timing tower (plan §M7). Mirrors the race `TimingTower`
 * layout but swaps GAP/LAST for three sector splits + BEST, adds the
 * ELIMINATION-ZONE separator, and renders an accessible non-colour OUT cue for
 * knocked-out drivers (opacity + line-through + an "OUT" badge).
 */
export function QualiTimingTower({ entries, cutlinePosition, className = '' }: QualiTimingTowerProps) {
  return (
    <div
      className={`flex flex-col font-mono text-[12px] bg-surface-paper border border-line-sub rounded-rad overflow-hidden ${className}`}
      role="table"
      aria-label="Qualifying timing tower"
    >
      {/* Header rowgroup */}
      <div role="rowgroup" className="contents">
        <div
          className="grid gap-2 px-3 py-1.5 border-b border-line-sub text-[9px] uppercase tracking-[0.14em] text-ink-dim"
          style={{ gridTemplateColumns: GRID_COLUMNS }}
          role="row"
        >
          <span role="columnheader" className="text-right">POS</span>
          <span role="columnheader"><span className="sr-only">Team</span></span>
          <span role="columnheader">CODE</span>
          <span role="columnheader">DRIVER</span>
          <span role="columnheader" className="text-right">S1</span>
          <span role="columnheader" className="text-right">S2</span>
          <span role="columnheader" className="text-right">S3</span>
          <span role="columnheader" className="text-right">BEST</span>
          <span role="columnheader" className="text-right">TIRE</span>
        </div>
      </div>

      {/* Elimination-zone announcement — a single stable live region, announced
          when cutlinePosition changes (NOT on every row reorder), to avoid the
          screen-reader spam a per-row aria-live separator would cause. */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {cutlinePosition > 0 ? `Elimination zone: P${cutlinePosition + 1} and below are eliminated` : ''}
      </div>

      {/* Body rowgroup */}
      <div role="rowgroup" className="contents">
      {entries.map((entry) => {
        const isLeader = entry.position === 1
        const out = entry.eliminated
        const hasLap = entry.bestLapTime !== null && entry.sectors !== null
        const showSeparator =
          cutlinePosition > 0 &&
          entry.position === cutlinePosition &&
          entries.some((e) => e.position > cutlinePosition)

        return (
          <Fragment key={entry.driverId}>
            <motion.div
              layout
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              role="row"
              aria-label={`P${entry.position} ${entry.driverName}${out ? ' (eliminated)' : ''}`}
              className={`
                relative grid gap-2 px-3 py-[7px] border-b border-line-hair items-center
                transition-[background] duration-[120ms]
                ${out
                  ? 'opacity-40'
                  : entry.isPlayer
                    ? 'bg-[oklch(0.20_0.03_25_/_0.35)]'
                    : 'hover:bg-surface-raised'
                }
              `}
              style={{ gridTemplateColumns: GRID_COLUMNS }}
            >
              {/* Player indicator bar */}
              {entry.isPlayer && (
                <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-sig-red" />
              )}

              {/* POS — leader gets the lime accent */}
              <span
                className={`text-right font-display font-bold text-[18px] leading-none tabular-nums tracking-[-0.02em] ${
                  isLeader ? 'text-[var(--accent-lime)]' : 'text-ink-hi'
                }`}
              >
                {entry.position}
              </span>

              {/* Team bar */}
              <span
                className="w-[4px] h-[22px] rounded-[1px] shrink-0"
                style={{ backgroundColor: entry.teamColor }}
              />

              {/* Driver code */}
              <span className={`font-display font-bold text-[13px] text-ink-hi tracking-[0.02em] uppercase truncate ${out ? 'line-through' : ''}`}>
                {entry.code}
              </span>

              {/* Name group */}
              <div className="flex flex-col gap-0 min-w-0">
                <span className={`font-body text-[10px] text-ink-dim tracking-[0.02em] truncate ${out ? 'line-through' : ''}`}>
                  {entry.driverName}
                </span>
              </div>

              {/* Sector splits */}
              <span className={`text-right text-[11px] text-ink-mute tabular-nums ${out ? 'line-through' : ''}`}>
                {hasLap ? formatSector(entry.sectors!.s1) : '—'}
              </span>
              <span className={`text-right text-[11px] text-ink-mute tabular-nums ${out ? 'line-through' : ''}`}>
                {hasLap ? formatSector(entry.sectors!.s2) : '—'}
              </span>
              <span className={`text-right text-[11px] text-ink-mute tabular-nums ${out ? 'line-through' : ''}`}>
                {hasLap ? formatSector(entry.sectors!.s3) : '—'}
              </span>

              {/* Best lap (or OUT badge for a knocked-out car) */}
              <span
                className={`text-right text-[11px] tabular-nums ${
                  out
                    ? 'text-sig-red font-bold tracking-[0.1em]'
                    : isLeader
                      ? 'text-sig-amber font-bold tracking-[0.04em]'
                      : 'text-ink-body'
                }`}
              >
                {out ? 'OUT' : entry.bestLapTime !== null ? formatTime(entry.bestLapTime) : '—'}
              </span>

              {/* Tire */}
              <span className={`text-right text-[11px] font-bold tabular-nums ${tireColorClass(entry.tire)}`}>
                {tireLetter(entry.tire)}
              </span>
            </motion.div>

            {/* Cutline separator — knockout zone begins below this row */}
            {showSeparator && (
              <div
                role="separator"
                className="px-3 py-1 border-t border-sig-red/60 bg-sig-red/[0.06] text-center"
              >
                <span className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-sig-red">
                  Elimination Zone — P{cutlinePosition + 1} and below
                </span>
              </div>
            )}
          </Fragment>
        )
      })}
      </div>
    </div>
  )
}
