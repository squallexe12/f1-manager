'use client'

import { useMemo } from 'react'
import type { Driver } from '@/types/driver'
import {
  expirePenaltyPoints,
  sumActivePoints,
} from '@/engine/drivers/penalty-points'
import {
  OFFENCE_LABELS,
  bandForPoints, colorForBand, labelForBand,
} from '@/components/strategy/penalty-labels'

// ─── Constants ────────────────────────────────────────────────────────────────

const WARNINGS_THRESHOLD = 5
const ROUNDS_PER_SEASON = 22

// ─── Expiry computation ───────────────────────────────────────────────────────

/**
 * Returns the season + round on which an entry expires
 * (i.e. exactly 22 rounds after issue, wrapping over season boundary).
 */
function computeExpiry(
  issuedSeason: number,
  issuedRound: number,
): { season: number; round: number } {
  const totalRound = issuedRound + ROUNDS_PER_SEASON
  if (totalRound <= ROUNDS_PER_SEASON) {
    return { season: issuedSeason, round: totalRound }
  }
  const extraRounds = totalRound - ROUNDS_PER_SEASON
  if (extraRounds <= ROUNDS_PER_SEASON) {
    return { season: issuedSeason + 1, round: extraRounds }
  }
  // Shouldn't happen with standard 22-round window, but handle gracefully
  return {
    season: issuedSeason + Math.floor(totalRound / ROUNDS_PER_SEASON),
    round:  totalRound % ROUNDS_PER_SEASON || ROUNDS_PER_SEASON,
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PenaltyRecordSectionProps {
  driver: Driver
  currentSeason: number
  currentRound: number
  className?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PenaltyRecordSection({
  driver,
  currentSeason,
  currentRound,
  className = '',
}: PenaltyRecordSectionProps) {
  const activeEntries = useMemo(
    () => expirePenaltyPoints(driver.penaltyPoints, currentSeason, currentRound),
    [driver.penaltyPoints, currentSeason, currentRound],
  )

  const total = useMemo(() => sumActivePoints(activeEntries), [activeEntries])

  // Sort newest-first for display
  const sortedEntries = useMemo(
    () =>
      [...activeEntries].sort((a, b) => {
        const seasonDelta = b.issuedSeason - a.issuedSeason
        if (seasonDelta !== 0) return seasonDelta
        return b.issuedRound - a.issuedRound
      }),
    [activeEntries],
  )

  // Fully clean record — render nothing
  const isClean =
    total === 0 &&
    driver.warningsThisSeason === 0 &&
    driver.banUntilRound === null

  if (isClean) return null

  const band  = bandForPoints(total)
  const color = colorForBand(band)
  const label = labelForBand(band)
  const isBanned = driver.banUntilRound !== null

  // Rounds until ban lifted (if banned)
  const roundsUntilBanLifted =
    isBanned && driver.banUntilRound !== null
      ? Math.max(0, driver.banUntilRound - currentRound)
      : 0

  const warningsFraction = Math.min(driver.warningsThisSeason / WARNINGS_THRESHOLD, 1)

  return (
    <div
      className={`bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-3 flex flex-col gap-3 ${className}`}
    >
      {/* Section header */}
      <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)]">
        Penalty Record
      </h3>

      {/* ── Ban status ──────────────────────────────────────────────────────── */}
      {isBanned && (
        <div
          className="rounded-md px-3 py-2 border flex items-center gap-2"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--accent-red) 10%, transparent)',
            borderColor:      'color-mix(in srgb, var(--accent-red) 35%, transparent)',
          }}
        >
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: 'var(--accent-red)' }}
          />
          <span className="text-xs font-heading font-bold uppercase text-[var(--accent-red)] tracking-wider">
            Banned
          </span>
          <span className="text-xs text-[var(--text-secondary)] ml-auto">
            Until Round {driver.banUntilRound}
            {roundsUntilBanLifted > 0 && (
              <span className="text-[var(--text-dim)]"> ({roundsUntilBanLifted} race{roundsUntilBanLifted !== 1 ? 's' : ''} away)</span>
            )}
          </span>
        </div>
      )}

      {/* ── Rolling-window total ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div
          className="text-3xl font-mono font-bold leading-none tabular-nums"
          style={{ color }}
        >
          {total}
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-heading uppercase tracking-wider text-[var(--text-dim)]">
            Penalty points
          </span>
          <span
            className="text-[10px] font-heading uppercase tracking-wider font-semibold"
            style={{ color }}
          >
            {label}
          </span>
        </div>

        {/* Risk bar — segments paint in band-distinct colours so the
            "approaching ban" tier is visually different from "banned". */}
        <div className="ml-auto flex items-center gap-1">
          {([
            { threshold:  3, color: colorForBand('clean')       },
            { threshold:  6, color: colorForBand('approaching') },
            { threshold:  9, color: colorForBand('warning')     },
            { threshold: 12, color: colorForBand('critical')    },
          ] as const).map(({ threshold, color: segColor }) => {
            const filled = total >= threshold
            return (
              <div
                key={threshold}
                className="w-6 h-1.5 rounded-full"
                style={{
                  backgroundColor: filled
                    ? segColor
                    : 'var(--border-hover)',
                  opacity: filled ? 1 : 0.35,
                }}
              />
            )
          })}
        </div>
      </div>

      {/* ── Active entries list ─────────────────────────────────────────────── */}
      {sortedEntries.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-heading uppercase tracking-wider text-[var(--text-dim)]">
            Active entries
          </span>
          {sortedEntries.map((entry, idx) => {
            const expiry = computeExpiry(entry.issuedSeason, entry.issuedRound)
            return (
              <div
                key={idx}
                className="flex items-start gap-2 py-1.5 border-b last:border-b-0"
                style={{ borderColor: 'var(--border-default)' }}
              >
                {/* Points badge */}
                <div
                  className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-[10px] font-mono font-bold"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--accent-amber) 12%, transparent)',
                    color: 'var(--accent-amber)',
                    border: '1px solid color-mix(in srgb, var(--accent-amber) 25%, transparent)',
                  }}
                >
                  +{entry.points}
                </div>

                {/* Offence + timing */}
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span className="text-xs text-[var(--text-secondary)] truncate">
                    {OFFENCE_LABELS[entry.offenceType] ?? entry.offenceType}
                  </span>
                  <div className="flex gap-2 text-[10px] text-[var(--text-dim)] font-mono">
                    <span>
                      Issued S{entry.issuedSeason} R{entry.issuedRound}
                    </span>
                    <span className="text-[var(--border-hover)]">·</span>
                    <span>
                      Expires S{expiry.season} R{expiry.round}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Season warnings ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-baseline">
          <span className="text-[10px] font-heading uppercase tracking-wider text-[var(--text-dim)]">
            Season warnings
          </span>
          <span
            className="text-xs font-mono"
            style={{
              color:
                driver.warningsThisSeason >= WARNINGS_THRESHOLD
                  ? 'var(--accent-red)'
                  : driver.warningsThisSeason >= 3
                    ? 'var(--accent-amber)'
                    : 'var(--text-secondary)',
            }}
          >
            {driver.warningsThisSeason} / {WARNINGS_THRESHOLD}
          </span>
        </div>

        {/* Progress track */}
        <div
          className="h-1 rounded-full overflow-hidden"
          style={{ backgroundColor: 'var(--border-hover)' }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${warningsFraction * 100}%`,
              backgroundColor:
                driver.warningsThisSeason >= WARNINGS_THRESHOLD
                  ? 'var(--accent-red)'
                  : driver.warningsThisSeason >= 3
                    ? 'var(--accent-amber)'
                    : '#4ADE80',
              transform: 'translateX(0)',
            }}
          />
        </div>

        {driver.warningsThisSeason >= WARNINGS_THRESHOLD && (
          <p className="text-[10px] text-[var(--accent-amber)]">
            Threshold reached — 10-place grid drop applied at next race start.
          </p>
        )}

        {driver.nextRaceGridDrop > 0 && (
          <p className="text-[10px] text-[var(--accent-amber)]">
            Grid drop pending: -{driver.nextRaceGridDrop} places at next qualifying.
          </p>
        )}
      </div>
    </div>
  )
}
