'use client'

import { useMemo } from 'react'
import { sumActivePoints } from '@/engine/drivers/penalty-points'
import type { AppliedPenalty } from '@/types/race'
import type { Driver } from '@/types/driver'
import { OFFENCE_LABELS, SANCTION_LABELS } from './penalty-labels'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Colour band for active penalty-point total. */
function pointsBandClass(total: number): string {
  if (total >= 12) return 'text-sig-red font-bold'
  if (total >= 9)  return 'text-[var(--sig-amber,#ffb800)] font-bold'
  if (total >= 5)  return 'text-[var(--sig-amber,#ffb800)]'
  return 'text-ink-dim'
}

/** Short dot-indicator colour for the point-totals list. */
function pointsDotColor(total: number): string {
  if (total >= 12) return 'var(--sig-red,#e10600)'
  if (total >= 9)  return 'var(--sig-amber,#ffb800)'
  if (total >= 5)  return 'var(--sig-amber,#ffb800)'
  return 'var(--sig-green,#39d353)'
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StewardsDecisionsPanelProps {
  /** Penalties applied this race, keyed by driver id. */
  appliedByDriver: Record<string, AppliedPenalty[]>
  /** All drivers (with post-race penaltyPoints, banUntilRound, nextRaceGridDrop). */
  drivers: Driver[]
  /** Short-name lookup: driverId → shortName. */
  driverShortNames: Record<string, string>
  /** The round that just completed. Used for ban-threshold detection. */
  currentRound: number
  className?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StewardsDecisionsPanel({
  appliedByDriver,
  drivers,
  driverShortNames,
  currentRound,
  className = '',
}: StewardsDecisionsPanelProps) {
  // ── Flatten all penalties into a sortable list ──────────────────────────────
  const allPenalties = useMemo(() => {
    const rows: Array<AppliedPenalty & { driverId: string; shortName: string }> = []
    for (const [driverId, penalties] of Object.entries(appliedByDriver)) {
      for (const p of penalties) {
        rows.push({
          ...p,
          driverId,
          shortName: driverShortNames[driverId] ?? driverId.slice(0, 3).toUpperCase(),
        })
      }
    }
    // Sort by lap, then by driver name for determinism
    rows.sort((a, b) => a.raceLap - b.raceLap || a.shortName.localeCompare(b.shortName))
    return rows
  }, [appliedByDriver, driverShortNames])

  // ── Per-driver active penalty-point totals ─────────────────────────────────
  // Only show drivers with at least 1 point or who have been involved this race.
  const pointTotals = useMemo(() => {
    const involvedIds = new Set(Object.keys(appliedByDriver))
    return drivers
      .filter((d) => !d.isReserve && !d.isF2 && d.teamId)
      .map((d) => ({
        driverId: d.id,
        shortName: driverShortNames[d.id] ?? d.shortName,
        total: sumActivePoints(d.penaltyPoints),
        banUntilRound: d.banUntilRound,
        nextRaceGridDrop: d.nextRaceGridDrop,
        isInvolved: involvedIds.has(d.id),
      }))
      .filter((d) => d.total > 0 || d.isInvolved)
      .sort((a, b) => b.total - a.total || a.shortName.localeCompare(b.shortName))
  }, [drivers, driverShortNames, appliedByDriver])

  // ── Threshold banners ──────────────────────────────────────────────────────
  const bannedThisRace = useMemo(
    () => drivers.filter((d) => d.banUntilRound === currentRound + 1),
    [drivers, currentRound],
  )

  const gridDropThisRace = useMemo(
    () => drivers.filter((d) => d.nextRaceGridDrop > 0),
    [drivers],
  )

  const hasBanners = bannedThisRace.length > 0 || gridDropThisRace.length > 0

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* ── Section heading ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-dim font-bold">
          Stewards&apos; Decisions
        </span>
        <div className="flex-1 h-px bg-line-hair" />
      </div>

      {/* ── Threshold banners ─────────────────────────────────────────────── */}
      {hasBanners && (
        <div className="flex flex-col gap-1.5">
          {bannedThisRace.map((d) => {
            const name = driverShortNames[d.id] ?? d.shortName
            return (
              <div
                key={`ban-${d.id}`}
                className="flex items-center gap-2.5 px-3 py-2 rounded-rad border border-sig-red"
                style={{ background: 'oklch(0.20 0.08 25 / 0.35)' }}
              >
                <span
                  className="font-mono text-[9px] uppercase tracking-[0.16em] font-bold text-sig-red shrink-0"
                >
                  NEXT-RACE BAN
                </span>
                <span className="font-display font-bold text-[13px] text-ink-hi tracking-[0.04em] uppercase">
                  {name}
                </span>
                <span className="font-mono text-[9px] text-ink-mute">
                  12-point threshold crossed
                </span>
              </div>
            )
          })}
          {gridDropThisRace.map((d) => {
            const name = driverShortNames[d.id] ?? d.shortName
            return (
              <div
                key={`drop-${d.id}`}
                className="flex items-center gap-2.5 px-3 py-2 rounded-rad border"
                style={{
                  borderColor: 'var(--sig-amber,#ffb800)',
                  background: 'oklch(0.20 0.06 60 / 0.30)',
                }}
              >
                <span
                  className="font-mono text-[9px] uppercase tracking-[0.16em] font-bold shrink-0"
                  style={{ color: 'var(--sig-amber,#ffb800)' }}
                >
                  10-PLACE GRID DROP
                </span>
                <span className="font-display font-bold text-[13px] text-ink-hi tracking-[0.04em] uppercase">
                  {name}
                </span>
                <span className="font-mono text-[9px] text-ink-mute">
                  5-warning threshold crossed
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Two-column grid: penalties table | point totals ────────────────── */}
      <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 260px' }}>

        {/* LEFT — Penalties This Race */}
        <div className="bg-surface-paper border border-line-sub rounded-rad overflow-hidden">
          <div className="px-3 py-2 bg-surface-raised border-b border-line-hair font-mono text-[9px] uppercase tracking-[0.16em] text-ink-hi font-bold">
            Penalties This Race
          </div>

          {allPenalties.length === 0 ? (
            <p className="px-3.5 py-3 font-mono text-[11px] text-ink-dim italic">
              No penalties this race
            </p>
          ) : (
            <>
              {/* Column headers */}
              <div
                className="grid gap-2 px-3 py-1.5 border-b border-line-hair
                           font-mono text-[8px] uppercase tracking-[0.14em] text-ink-dim"
                style={{ gridTemplateColumns: '52px 1fr 100px 42px 38px' }}
              >
                <div>LAP</div>
                <div>DRIVER · OFFENCE</div>
                <div>SANCTION</div>
                <div className="text-right">+SEC</div>
                <div className="text-right">+PTS</div>
              </div>

              {/* Rows */}
              {allPenalties.map((p, i) => {
                const isLast = i === allPenalties.length - 1
                return (
                  <div
                    key={`${p.driverId}-${p.raceLap}-${i}`}
                    className={[
                      'grid gap-2 px-3 py-2 font-mono text-[11px] items-center',
                      isLast ? '' : 'border-b border-line-hair',
                    ].join(' ')}
                    style={{ gridTemplateColumns: '52px 1fr 100px 42px 38px' }}
                  >
                    {/* Lap */}
                    <div className="text-ink-dim tabular-nums text-[10px]">
                      L{p.raceLap}
                    </div>

                    {/* Driver + Offence */}
                    <div className="flex flex-col min-w-0">
                      <span
                        className="font-display font-bold text-[12px] text-ink-hi tracking-[0.04em] uppercase leading-none"
                        style={{ color: 'var(--sig-amber,#ffb800)' }}
                      >
                        {p.shortName}
                      </span>
                      <span className="text-[9px] text-ink-mute leading-snug mt-0.5 truncate">
                        {OFFENCE_LABELS[p.offenceType] ?? p.offenceType}
                      </span>
                    </div>

                    {/* Sanction */}
                    <div className="text-ink-body text-[10px] truncate">
                      {SANCTION_LABELS[p.sanction] ?? p.sanction}
                    </div>

                    {/* Time penalty */}
                    <div className="text-right tabular-nums text-ink-body text-[10px]">
                      {p.timePenaltySeconds > 0 ? `+${p.timePenaltySeconds}` : '—'}
                    </div>

                    {/* Penalty points */}
                    <div
                      className="text-right tabular-nums text-[10px]"
                      style={{
                        color: p.penaltyPointsIssued > 0
                          ? 'var(--sig-amber,#ffb800)'
                          : 'var(--ink-dim)',
                      }}
                    >
                      {p.penaltyPointsIssued > 0 ? `+${p.penaltyPointsIssued}` : '—'}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* RIGHT — Penalty-Point Totals */}
        <div className="bg-surface-paper border border-line-sub rounded-rad overflow-hidden">
          <div className="px-3 py-2 bg-surface-raised border-b border-line-hair font-mono text-[9px] uppercase tracking-[0.16em] text-ink-hi font-bold">
            Penalty Points
          </div>

          {pointTotals.length === 0 ? (
            <p className="px-3.5 py-3 font-mono text-[11px] text-ink-dim italic">
              No drivers with active points
            </p>
          ) : (
            <div className="flex flex-col">
              {pointTotals.map((d, i) => {
                const isLast = i === pointTotals.length - 1
                return (
                  <div
                    key={d.driverId}
                    className={[
                      'flex items-center justify-between gap-2 px-3 py-2 font-mono text-[11px]',
                      isLast ? '' : 'border-b border-line-hair',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Colour dot */}
                      <span
                        className="w-[6px] h-[6px] rounded-full shrink-0"
                        style={{ background: pointsDotColor(d.total) }}
                        aria-hidden
                      />
                      <span className="font-display font-bold text-[12px] text-ink-hi tracking-[0.04em] uppercase truncate">
                        {d.shortName}
                      </span>
                      {d.banUntilRound != null && (
                        <span
                          className="font-mono text-[8px] font-bold uppercase tracking-[0.1em] px-[4px] py-[2px] rounded-[2px] leading-none shrink-0"
                          style={{
                            background: 'var(--sig-red,#e10600)',
                            color: '#fff',
                          }}
                        >
                          BAN
                        </span>
                      )}
                    </div>
                    <span className={`tabular-nums ${pointsBandClass(d.total)}`}>
                      {d.total}
                      <span className="text-ink-dim font-normal">/12</span>
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Legend */}
          <div className="px-3 py-2 border-t border-line-hair flex flex-wrap gap-x-3 gap-y-1">
            {(
              [
                { color: 'var(--sig-green,#39d353)',   label: '0–4' },
                { color: 'var(--sig-amber,#ffb800)',   label: '5–11' },
                { color: 'var(--sig-red,#e10600)',     label: '12 (ban)' },
              ] as const
            ).map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1">
                <span
                  className="w-[5px] h-[5px] rounded-full shrink-0"
                  style={{ background: color }}
                  aria-hidden
                />
                <span className="font-mono text-[8px] text-ink-dim">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
