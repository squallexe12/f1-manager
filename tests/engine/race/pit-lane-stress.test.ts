import { describe, it, expect } from 'vitest'
import { simulatePitLane, type PitLaneSimCarInput } from '@/engine/race/pit-lane-engine'
import { DEFAULT_PENALTY_CALIBRATION } from '@/data/penalty-calibration'
import { DEFAULT_PITLANE_CALIBRATION } from '@/types/calibration'
import { createPRNG } from '@/engine/core/prng'

/**
 * Tier B v2 — sub-step performance + PRNG-burn stability under load.
 *
 * Worst-case race lap: every car on the grid pits on the same lap (rain
 * transition, safety-car exit, etc.). The sub-step needs to stay well below
 * the main-loop tick budget so worker stutter is invisible.
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

describe('pit-lane stress test', () => {
  it('20-car simultaneous pit completes within wall-clock budget', () => {
    const cars = Array.from({ length: 20 }, (_, i) => makeCar(`drv-${String(i).padStart(2, '0')}`))
    const start = performance.now()
    const result = simulatePitLane(
      {
        cars,
        pitLane: DEFAULT_PITLANE_CALIBRATION,
        pitLossMean: 21,
        pitLossStddev: 1.5,
        calibration: DEFAULT_PENALTY_CALIBRATION,
      },
      createPRNG(99),
    )
    const elapsedMs = performance.now() - start

    expect(Object.keys(result.timings)).toHaveLength(20)
    expect(Object.keys(result.addedLapTime)).toHaveLength(20)
    // Plan target: <100ms wall-clock. Local dev typically lands well under
    // that; this assertion exists so a future regression that ticks
    // pathologically (e.g. shrinking SUB_STEP_DT to 0.001) is caught early.
    expect(elapsedMs, `20-car sub-step took ${elapsedMs.toFixed(1)}ms`).toBeLessThan(500)
  })

  it('PRNG ordering is stable when input order is permuted', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `drv-${i}`)
    const carsAsc = ids.map(makeCar)
    const carsDesc = [...carsAsc].reverse()
    const a = simulatePitLane(
      { cars: carsAsc, pitLane: DEFAULT_PITLANE_CALIBRATION, pitLossMean: 21, pitLossStddev: 1.5, calibration: DEFAULT_PENALTY_CALIBRATION },
      createPRNG(7),
    )
    const b = simulatePitLane(
      { cars: carsDesc, pitLane: DEFAULT_PITLANE_CALIBRATION, pitLossMean: 21, pitLossStddev: 1.5, calibration: DEFAULT_PENALTY_CALIBRATION },
      createPRNG(7),
    )
    expect(a.timings).toEqual(b.timings)
    expect(a.addedLapTime).toEqual(b.addedLapTime)
  })
})
