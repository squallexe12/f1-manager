import { describe, it, expect } from 'vitest'
import { createPRNG } from '@/engine/core/prng'
import type { RaceFlag } from '@/types/race'
import {
  rollLapIncidents,
  cautionFromIncidents,
  mixSeed,
  DEFAULT_RACE_INCIDENT_CONFIG,
  type RaceIncidentDriver,
} from '@/engine/race/race-incidents'
import { advanceRaceFlags, DEFAULT_CAUTION_CONFIG } from '@/engine/race/race-flags'
import { CIRCUITS } from '@/data/circuits'

/**
 * Race-incidents season-frequency calibration harness.
 *
 * Gated behind RACE_INCIDENTS_FREQUENCY=1 so it NEVER runs in the normal suite
 * (mirrors the Tier C TRACK_LIMITS_FREQUENCY precedent). Run locally via:
 *   `RACE_INCIDENTS_FREQUENCY=1 npx vitest run tests/engine/race/race-incidents-frequency.test.ts`
 *
 * It replays a full seeded 24-race season for a 20-car field, driving the SAME
 * pure functions the simulator's end-of-lap block uses (`rollLapIncidents` ->
 * `cautionFromIncidents` -> `advanceRaceFlags`) in the same per-lap consumption
 * order against the real circuit lap counts. Because the incident layer runs on
 * a per-lap PRNG derived from `(raceSeed, lap)`, this is a faithful frequency
 * estimate independent of the main lap-time loop.
 *
 * Spec §11 targets (neutral-realistic field):
 *   - retirements/race:  ~1-3
 *   - full SC/race:      ~0.5-0.7   (plus occasional VSC/yellow)
 *
 * MEASURED (DEFAULT_RACE_INCIDENT_CONFIG, 20-car neutral field, 12-seed mean):
 *   - retirements/race ≈ _.__   (fill from first run)
 *   - full SC/race     ≈ _.__   (fill from first run)
 *   - any caution/race ≈ _.__
 *
 * After the first run, tune DEFAULT_RACE_INCIDENT_CONFIG (Task 2) to land in the
 * spec envelope, then set the bands below to the measured envelope (±20%) with
 * the spec target visible in the log line.
 */

const RUN_HARNESS = process.env.RACE_INCIDENTS_FREQUENCY === '1'
const SEED_BASE = Number(process.env.RACE_INCIDENTS_FREQUENCY_SEED ?? 90_000)

/** Build a neutral-realistic N-car field with stable ids c01..cNN. */
function neutralField(n = 20): RaceIncidentDriver[] {
  const out: RaceIncidentDriver[] = []
  for (let i = 1; i <= n; i++) {
    out.push({
      id: `c${String(i).padStart(2, '0')}`,
      racecraft: 70,
      experience: 70,
      frustration: 40,
      reliability: 80,
    })
  }
  return out
}

interface SeasonIncidentTotals {
  retirements: number
  fullSc: number
  anyCaution: number
}

/**
 * Replay one full season's incident layer for a field. `raceSeedBase` varies the
 * per-race seed (raceSeed = raceSeedBase + raceIndex), matching how the simulator
 * derives a distinct raceSeed per round. Returns SEASON totals (divide by the
 * race count for per-race rates).
 */
function replaySeasonIncidents(field: RaceIncidentDriver[], raceSeedBase: number): SeasonIncidentTotals {
  let retirements = 0
  let fullSc = 0
  let anyCaution = 0

  for (let raceIdx = 0; raceIdx < CIRCUITS.length; raceIdx++) {
    const circuit = CIRCUITS[raceIdx]
    const raceSeed = (raceSeedBase + raceIdx) | 0
    const dnf: Record<string, true> = {}
    let flag: RaceFlag = 'green'
    let cautionLapsRemaining = 0

    for (let lap = 1; lap <= circuit.laps; lap++) {
      const incidentRng = createPRNG(mixSeed(raceSeed, lap))
      const rolls = rollLapIncidents(
        { drivers: field, dnfDriverIds: dnf, currentLap: lap, totalLaps: circuit.laps, wet: false, circuitRiskFactor: 1, config: DEFAULT_RACE_INCIDENT_CONFIG },
        incidentRng,
      )
      for (const r of rolls) {
        if (r.retired) { retirements++; dnf[r.driverId] = true }
      }
      const severity = cautionFromIncidents(rolls)
      const transition = advanceRaceFlags({ safetyCar: flag, cautionLapsRemaining }, incidentRng, severity, DEFAULT_CAUTION_CONFIG)
      flag = transition.safetyCar
      cautionLapsRemaining = transition.cautionLapsRemaining
      if (transition.deployed !== null) {
        anyCaution++
        if (transition.deployed === 'sc') fullSc++
      }
    }
  }

  return { retirements, fullSc, anyCaution }
}

describe.skipIf(!RUN_HARNESS)('race-incidents season frequency harness (RACE_INCIDENTS_FREQUENCY=1)', () => {
  it('a neutral 20-car season lands ~1-3 retirements/race and ~0.5-0.7 full SC/race', () => {
    const SAMPLES = Number(process.env.RACE_INCIDENTS_FREQUENCY_SAMPLES ?? 12)
    const races = CIRCUITS.length
    const field = neutralField(20)

    let retirements = 0
    let fullSc = 0
    let anyCaution = 0
    for (let s = 0; s < SAMPLES; s++) {
      const totals = replaySeasonIncidents(field, SEED_BASE + s * races)
      retirements += totals.retirements
      fullSc += totals.fullSc
      anyCaution += totals.anyCaution
    }

    const perRace = (n: number) => n / SAMPLES / races
    const retPerRace = perRace(retirements)
    const scPerRace = perRace(fullSc)
    const cautionPerRace = perRace(anyCaution)

    console.log(
      `[race-incidents-frequency] samples=${SAMPLES} field=20 -> ` +
      `retirements≈${retPerRace.toFixed(2)}/race (spec 1-3), ` +
      `full SC≈${scPerRace.toFixed(2)}/race (spec 0.5-0.7), ` +
      `any caution≈${cautionPerRace.toFixed(2)}/race`,
    )

    // STARTING bands = spec envelope. After the first measured run + the Task 2
    // tune, set these to the measured envelope (±20%) with the spec target kept
    // in the log line above (Tier C harness policy).
    expect(retPerRace, 'retirements/race (spec target 1-3)').toBeGreaterThanOrEqual(1)
    expect(retPerRace, 'retirements/race').toBeLessThanOrEqual(3)
    expect(scPerRace, 'full SC/race (spec target 0.5-0.7)').toBeGreaterThanOrEqual(0.4)
    expect(scPerRace, 'full SC/race').toBeLessThanOrEqual(0.8)
  })

  it('the rate is mostly independent of one entrant: a single aggressive car barely moves the season SC rate', () => {
    // Swap one car to reckless attributes; the season-wide SC rate should stay
    // within the spec envelope (the field-wide hazard dominates, not one car).
    const SAMPLES = Number(process.env.RACE_INCIDENTS_FREQUENCY_SAMPLES ?? 12)
    const races = CIRCUITS.length
    const field = neutralField(20)
    field[0] = { id: 'c01', racecraft: 20, experience: 20, frustration: 95, reliability: 50 }

    let fullSc = 0
    for (let s = 0; s < SAMPLES; s++) {
      fullSc += replaySeasonIncidents(field, SEED_BASE + 1000 + s * races).fullSc
    }
    const scPerRace = fullSc / SAMPLES / races
    console.log(`[race-incidents-frequency] one-reckless-car field -> full SC≈${scPerRace.toFixed(2)}/race (spec 0.5-0.7)`)
    expect(scPerRace, 'full SC/race with one reckless car (must stay near the field-driven rate)').toBeLessThanOrEqual(1.0)
  })
})

// Cheap always-on sanity test: confirms the harness helper compiles and returns
// a well-shaped, non-negative result. The full envelope run is env-gated.
describe('race-incidents season frequency harness helpers', () => {
  it('replaySeasonIncidents returns non-negative totals', () => {
    const totals = replaySeasonIncidents(neutralField(20), 12345)
    expect(totals.retirements).toBeGreaterThanOrEqual(0)
    expect(totals.fullSc).toBeGreaterThanOrEqual(0)
    expect(totals.anyCaution).toBeGreaterThanOrEqual(totals.fullSc)
  })
})
