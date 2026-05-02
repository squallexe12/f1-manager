import type { PenaltyPointEntry } from '@/types/driver'

const DEFAULT_WINDOW_ROUNDS = 22
const ROUNDS_PER_SEASON = 22

/**
 * Removes entries whose age in rounds (across season boundaries) has reached
 * or exceeded the rolling window. Pure: returns a new array.
 */
export function expirePenaltyPoints(
  entries: PenaltyPointEntry[],
  currentSeason: number,
  currentRound: number,
  windowRounds: number = DEFAULT_WINDOW_ROUNDS,
): PenaltyPointEntry[] {
  return entries.filter((entry) => {
    const ageInRounds =
      (currentSeason - entry.issuedSeason) * ROUNDS_PER_SEASON +
      (currentRound - entry.issuedRound)
    return ageInRounds < windowRounds
  })
}

export function sumActivePoints(entries: PenaltyPointEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.points, 0)
}

/**
 * Returns the season + round on which a penalty-point entry is removed by
 * `expirePenaltyPoints` (i.e. the first round where its rolling-window age
 * reaches `windowRounds`). Mirrors the engine's expiry math so UI surfaces
 * displaying "Expires S{n} R{m}" stay in lockstep with the engine if the
 * window or season length ever changes.
 */
export function entryExpiresAt(
  entry: PenaltyPointEntry,
  windowRounds: number = DEFAULT_WINDOW_ROUNDS,
): { season: number; round: number } {
  const total = entry.issuedRound + windowRounds
  const seasonOffset = Math.ceil(total / ROUNDS_PER_SEASON) - 1
  const round = total - seasonOffset * ROUNDS_PER_SEASON
  return { season: entry.issuedSeason + seasonOffset, round }
}

/**
 * Sorts newest-first; accumulates points until cumulative sum >= threshold;
 * removes those entries. Returns the surviving older entries. Pure.
 */
export function wipeContributingPoints(
  entries: PenaltyPointEntry[],
  threshold: number,
): PenaltyPointEntry[] {
  const sorted = [...entries].sort((a, b) => {
    const seasonDelta = b.issuedSeason - a.issuedSeason
    if (seasonDelta !== 0) return seasonDelta
    return b.issuedRound - a.issuedRound
  })

  let running = 0
  const dropIndices: number[] = []
  for (let i = 0; i < sorted.length; i++) {
    if (running >= threshold) break
    running += sorted[i].points
    dropIndices.push(i)
  }

  // Only wipe if the accumulated sum actually reached the threshold
  if (running < threshold) return [...entries]

  // Filter on the ORIGINAL list to preserve original ordering of survivors
  const dropped = new Set(dropIndices.map((i) => sorted[i]))
  return entries.filter((e) => !dropped.has(e))
}
