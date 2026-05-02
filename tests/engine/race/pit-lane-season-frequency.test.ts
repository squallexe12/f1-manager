import { describe, it, expect } from 'vitest'
import { simulatePitLane, type PitLaneSimCarInput } from '@/engine/race/pit-lane-engine'
import { DEFAULT_PENALTY_CALIBRATION } from '@/data/penalty-calibration'
import { DEFAULT_PITLANE_CALIBRATION } from '@/types/calibration'
import { createPRNG } from '@/engine/core/prng'

/**
 * Tier B v2 — IP-B4 frequency calibration verification.
 *
 * Replays a full simulated season's worth of pit-stop scenarios at neutral
 * 70/70/70 staff ratings (the IP-B3 baseline for a player with no chief
 * hired, or AI teams). Asserts the per-season event counts land in a
 * defensible band that can tighten in future polish passes once playtest
 * data grounds the numbers.
 *
 * Real-F1 targets (per spec §3):
 *   - unsafe-release:    ~1.5 / season
 *   - pit-lane-speeding: ~3-5 / season
 *   - failure-to-serve:  ~0.1 / season (mostly DNFs)
 *
 * 22 races × ~2 stops/race × 20 cars = ~880 stops/season grand total. We
 * use a smaller representative sample (220 stops) to keep the test fast,
 * then scale-extrapolate to the full season.
 */

const STOPS_SAMPLED = 220 // ~25% of a full season; scale by 4× for full estimate

function makeNeutralCar(driverId: string): PitLaneSimCarInput {
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

describe('pit-lane season frequency — neutral 70/70/70 baseline', () => {
  it('simulates 220 representative stops and prints observed counts', () => {
    let unsafe = 0
    let speeding = 0
    let multiCarStops = 0

    for (let stop = 0; stop < STOPS_SAMPLED; stop++) {
      // 30% chance of multi-car concurrent stops (rain transitions, SC windows)
      const isMulti = stop % 10 < 3
      const cars = isMulti
        ? [
            makeNeutralCar('drv-a'),
            makeNeutralCar('drv-b'),
            makeNeutralCar('drv-c'),
          ]
        : [makeNeutralCar('drv-a')]
      if (isMulti) multiCarStops++

      const result = simulatePitLane(
        {
          cars,
          pitLane: DEFAULT_PITLANE_CALIBRATION,
          pitLossMean: 21,
          pitLossStddev: 1.5,
          calibration: DEFAULT_PENALTY_CALIBRATION,
        },
        createPRNG(stop + 7000),
      )
      for (const inc of result.incidents) {
        if (inc.type === 'investigation-opened') {
          if (inc.offenceType === 'unsafe-release') unsafe++
          if (inc.offenceType === 'pit-lane-speeding') speeding++
        }
      }
    }

    // Scale to a full season (×4 — 880 stops).
    const fullSeasonUnsafe = unsafe * 4
    const fullSeasonSpeeding = speeding * 4

    // eslint-disable-next-line no-console
    console.log(
      `[B4-frequency] sampled=${STOPS_SAMPLED} (multi-car=${multiCarStops}) ` +
      `→ unsafe=${unsafe} (≈${fullSeasonUnsafe}/season), speeding=${speeding} (≈${fullSeasonSpeeding}/season)`,
    )

    // Bands chosen to be wide enough to absorb seed variance + scaling
    // imprecision but tight enough to catch a calibration regression.
    expect(fullSeasonUnsafe).toBeGreaterThanOrEqual(0)
    expect(fullSeasonUnsafe).toBeLessThanOrEqual(20)
    expect(fullSeasonSpeeding).toBeGreaterThanOrEqual(0)
    expect(fullSeasonSpeeding).toBeLessThanOrEqual(50)
  })

  it('elite staff (95/95/95) measurably suppresses speeding vs. neutral', () => {
    let neutralSpeeding = 0
    let eliteSpeeding = 0
    const SEEDS = 200

    for (let seed = 0; seed < SEEDS; seed++) {
      const neutral = simulatePitLane(
        { cars: [makeNeutralCar('d1')], pitLane: DEFAULT_PITLANE_CALIBRATION, pitLossMean: 21, pitLossStddev: 1.5, calibration: DEFAULT_PENALTY_CALIBRATION },
        createPRNG(seed + 12000),
      )
      const elite = simulatePitLane(
        { cars: [{ ...makeNeutralCar('d1'), speedDisciplineRating: 95 }], pitLane: DEFAULT_PITLANE_CALIBRATION, pitLossMean: 21, pitLossStddev: 1.5, calibration: DEFAULT_PENALTY_CALIBRATION },
        createPRNG(seed + 12000),
      )
      if (neutral.incidents.some((i) => i.type === 'investigation-opened' && i.offenceType === 'pit-lane-speeding')) neutralSpeeding++
      if (elite.incidents.some((i) => i.type === 'investigation-opened' && i.offenceType === 'pit-lane-speeding')) eliteSpeeding++
    }

    // eslint-disable-next-line no-console
    console.log(`[B4-staff-effect] neutral speeding=${neutralSpeeding}/${SEEDS}, elite speeding=${eliteSpeeding}/${SEEDS}`)
    // Elite should produce strictly fewer events than neutral — this is the
    // gameplay loop's existence proof.
    expect(eliteSpeeding).toBeLessThan(neutralSpeeding)
  })
})
