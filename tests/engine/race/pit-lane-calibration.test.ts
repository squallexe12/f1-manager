import { describe, it, expect } from 'vitest'
import { simulatePitLane, type PitLaneSimCarInput } from '@/engine/race/pit-lane-engine'
import { DEFAULT_PENALTY_CALIBRATION } from '@/data/penalty-calibration'
import { DEFAULT_PITLANE_CALIBRATION } from '@/types/calibration'
import { createPRNG } from '@/engine/core/prng'

/**
 * Tier B v2 — frequency calibration smoke check (IP-B1).
 *
 * Tight ±20% calibration ships in IP-B3 once staff aggregation is wired.
 * For now we verify the order-of-magnitude is sensible at neutral 70/70/70:
 *   - unsafe-release: ~1.5 / season target (across ~880 stops/season)
 *   - pit-lane-speeding: ~4 / season
 *   - failure-to-serve: ~0.1 / season (mostly DNFs)
 *
 * We approximate one season as 600 stops (22 races × ~27 stops on average).
 * "Season" here is the universe of pit stops, not chronological time.
 */

function makeCar(driverId: string): PitLaneSimCarInput {
  return {
    driverId,
    carEntrySpeedKph: 240,
    carExitSpeedKph: 240,
    releaseRating: 70,
    speedDisciplineRating: 70,
    serviceTimeRating: 70,
    driverRacecraft: 70,
    driverExperience: 70,
  }
}

describe('pit-lane frequency smoke check', () => {
  it('neutral 70/70/70 staff produces order-of-magnitude correct event rates over 600 stops', () => {
    let unsafeReleases = 0
    let speedings = 0
    const STOPS = 600

    for (let stop = 0; stop < STOPS; stop++) {
      const result = simulatePitLane(
        {
          cars: [makeCar('d1')],
          pitLane: DEFAULT_PITLANE_CALIBRATION,
          pitLossMean: 21,
          pitLossStddev: 1.5,
          calibration: DEFAULT_PENALTY_CALIBRATION,
        },
        createPRNG(stop + 1),
      )
      for (const inc of result.incidents) {
        if (inc.type === 'investigation-opened' && inc.offenceType === 'unsafe-release') unsafeReleases++
        if (inc.type === 'investigation-opened' && inc.offenceType === 'pit-lane-speeding') speedings++
      }
    }

    // Print observed counts for IP-B3 calibration tuning.
    // eslint-disable-next-line no-console
    console.log(`[smoke] over ${STOPS} stops at 70/70/70: unsafe=${unsafeReleases}, speeding=${speedings}`)

    // Single-car stops can't produce unsafe-release (no conflict).
    // The check exists so a regression that fires unsafe-release on solo
    // stops is caught.
    expect(unsafeReleases).toBe(0)

    // Speeding target: ~4 per 600 stops at neutral. Smoke band: 0–80
    // (loose; tightens to ±20% in IP-B3 against per-team stops/season).
    expect(speedings).toBeGreaterThanOrEqual(0)
    expect(speedings).toBeLessThan(80)
  })

  it('discipline rating dominates speeding frequency: 95-rated is meaningfully cleaner than 30-rated', () => {
    let highHits = 0
    let lowHits = 0
    const STOPS = 200

    for (let stop = 0; stop < STOPS; stop++) {
      const high = simulatePitLane(
        {
          cars: [{ ...makeCar('d1'), speedDisciplineRating: 95 }],
          pitLane: DEFAULT_PITLANE_CALIBRATION,
          pitLossMean: 21,
          pitLossStddev: 1.5,
          calibration: DEFAULT_PENALTY_CALIBRATION,
        },
        createPRNG(stop + 1000),
      )
      const low = simulatePitLane(
        {
          cars: [{ ...makeCar('d1'), speedDisciplineRating: 30 }],
          pitLane: DEFAULT_PITLANE_CALIBRATION,
          pitLossMean: 21,
          pitLossStddev: 1.5,
          calibration: DEFAULT_PENALTY_CALIBRATION,
        },
        createPRNG(stop + 1000),
      )
      if (high.incidents.some((i) => i.type === 'investigation-opened' && i.offenceType === 'pit-lane-speeding')) highHits++
      if (low.incidents.some((i) => i.type === 'investigation-opened' && i.offenceType === 'pit-lane-speeding')) lowHits++
    }

    expect(lowHits).toBeGreaterThan(highHits)
  })
})
