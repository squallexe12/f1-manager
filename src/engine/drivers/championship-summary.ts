import type { Driver } from '@/types/driver'

export interface ChampionshipSummary {
  positionById: Record<string, number>
  gapById: Record<string, number>
}

/**
 * Derive per-driver championship position and gap from the current driver
 * list. Used by `processPostRace` to build the pulse context after all stat
 * mutations have settled, and by the v12→v13 migration to seed pulse on load.
 *
 * Pure: does not mutate input. Same input → identical output.
 *
 * Gap semantics:
 * - Leader (position 1): gapById[id] = leaderPts − p2Pts (points clear of P2).
 * - Everyone else: gapById[id] = driverPts − leaderPts (negative = behind leader).
 */
export function computeChampionshipSummary(drivers: Driver[]): ChampionshipSummary {
  const sorted = [...drivers]
    .filter(d => !d.isReserve && d.teamId !== null)
    .sort((a, b) => b.seasonStats.points - a.seasonStats.points)
  const positionById: Record<string, number> = {}
  const gapById: Record<string, number> = {}
  const leaderPts = sorted[0]?.seasonStats.points ?? 0
  const p2Pts = sorted[1]?.seasonStats.points ?? 0
  sorted.forEach((d, i) => {
    positionById[d.id] = i + 1
    if (i === 0) {
      gapById[d.id] = leaderPts - p2Pts // leader's gap = points clear of P2
    } else {
      gapById[d.id] = d.seasonStats.points - leaderPts // negative = behind
    }
  })
  return { positionById, gapById }
}
