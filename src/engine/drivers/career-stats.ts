import type { Driver } from '@/types/driver'

/**
 * DNF sentinel value used by the form/result pipeline. Any position >= 21 is
 * treated as a DNF (matches `FORM_DNF` in `form-history.ts`). DNFs still
 * count as a career start.
 */
const DNF_THRESHOLD = 21

/**
 * Update career counters after a single race finish.
 *
 * Pure: returns a new Driver, does not mutate input.
 *
 * - `careerStarts` always increments (DNFs count as starts).
 * - `careerWins` increments iff finishingPosition === 1.
 * - `careerPodiums` increments iff 1 ≤ finishingPosition ≤ 3.
 *
 * Idempotency is the caller's responsibility: `processPostRace` already
 * gates per-driver updates on `seasonStats.lastProcessedRound`. This helper
 * is invoked from inside that guard so it cannot double-count.
 */
export function applyRaceCareerDeltas(driver: Driver, finishingPosition: number): Driver {
  const isDnf = finishingPosition >= DNF_THRESHOLD
  return {
    ...driver,
    careerStarts: driver.careerStarts + 1,
    careerWins: !isDnf && finishingPosition === 1
      ? driver.careerWins + 1
      : driver.careerWins,
    careerPodiums: !isDnf && finishingPosition >= 1 && finishingPosition <= 3
      ? driver.careerPodiums + 1
      : driver.careerPodiums,
  }
}

/**
 * Award a Drivers' Championship title at season end.
 *
 * Pure: returns a new Driver, does not mutate input.
 *
 * Called once per driver from `processSeasonEnd`. `finalStanding` is the
 * driver's final position in the Drivers' Championship after all rounds
 * have been processed (1 = champion).
 */
export function applySeasonEndCareerDeltas(driver: Driver, finalStanding: number): Driver {
  if (finalStanding !== 1) return driver
  return { ...driver, worldTitles: driver.worldTitles + 1 }
}
