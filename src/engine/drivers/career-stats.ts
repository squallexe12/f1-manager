import type { Driver } from '@/types/driver'
import { FORM_DNF } from '@/engine/drivers/form-history'

// Re-export so consumers don't need to know about form-history.
export { FORM_DNF }

/**
 * Update career counters after a single race finish.
 *
 * Pure: returns a new Driver, does not mutate input.
 *
 * - `careerStarts` always increments (DNFs count as starts).
 * - `careerWins` increments iff `!dnf && finishingPosition === 1`.
 * - `careerPodiums` increments iff `!dnf && 1 ≤ finishingPosition ≤ 3`.
 *
 * The caller passes `dnf` explicitly — `processPostRace` already has
 * `result.dnf: boolean` from the race worker; relying on it avoids duplicating
 * the position-sentinel inference here.
 *
 * Idempotency is the caller's responsibility: `processPostRace` already
 * gates per-driver updates on `seasonStats.lastProcessedRound`. This helper
 * is invoked from inside that guard so it cannot double-count.
 */
export function applyRaceCareerDeltas(driver: Driver, finishingPosition: number, dnf: boolean): Driver {
  return {
    ...driver,
    careerStarts: driver.careerStarts + 1,
    careerWins: !dnf && finishingPosition === 1
      ? driver.careerWins + 1
      : driver.careerWins,
    careerPodiums: !dnf && finishingPosition >= 1 && finishingPosition <= 3
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
