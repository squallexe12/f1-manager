import { describe, it, expect } from 'vitest'
import {
  evaluateUnsafeRelease,
  evaluatePitLaneSpeeding,
  simulatePitLane,
  type UnsafeReleaseInput,
  type PitLaneSpeedingInput,
  type PitLaneSimInput,
  type PitLaneSimCarInput,
} from '@/engine/race/pit-lane-engine'
import { DEFAULT_PENALTY_CALIBRATION } from '@/data/penalty-calibration'
import { createPRNG } from '@/engine/core/prng'
import type { PitLaneCarState } from '@/types/pit-lane'
import type { PitLaneCalibration } from '@/types/calibration'
import type { RaceIncident } from '@/types/race'

const STD_LANE: PitLaneCalibration = {
  lengthMeters: 350,
  speedLimitKph: 80,
  entryDecelMeters: 40,
  exitAccelMeters: 40,
}

function makeCar(driverId: string, overrides: Partial<PitLaneCarState> = {}): PitLaneCarState {
  return {
    driverId,
    zone: 'limit-zone',
    enteredAtSeconds: 0,
    zoneEnteredAtSeconds: 0,
    speedKph: 80,
    positionMeters: 40,
    serviceStartSeconds: 0,
    serviceEndSeconds: 2,
    releasedAtSeconds: 2,
    ...overrides,
  }
}

// ─── evaluateUnsafeRelease ────────────────────────────────────────────────────

describe('evaluateUnsafeRelease', () => {
  function baseInput(overrides: Partial<UnsafeReleaseInput> = {}): UnsafeReleaseInput {
    return {
      releasedCar: makeCar('rel'),
      potentiallyConflictingCars: [],
      releasedCrewRelease: 70,
      releasedDriverRacecraft: 70,
      conflictingDistanceMeters: 50,
      conflictingClosingSpeedKph: 80,
      calibration: DEFAULT_PENALTY_CALIBRATION,
      ...overrides,
    }
  }

  it('clean release with no conflicting cars → decision is null', () => {
    const result = evaluateUnsafeRelease(baseInput())
    expect(result.decision).toBeNull()
  })

  it('release into a closing car within safety margin → decision blamed on released-car driver', () => {
    const result = evaluateUnsafeRelease(baseInput({
      potentiallyConflictingCars: [makeCar('threat', { zone: 'entry-decel', positionMeters: 35 })],
      conflictingDistanceMeters: 6,            // very close
      conflictingClosingSpeedKph: 80,
      releasedCrewRelease: 30,                 // sloppy crew
      releasedDriverRacecraft: 40,
    }))
    expect(result.decision).not.toBeNull()
    expect(result.decision!.driverId).toBe('rel')
    expect(result.decision!.offenceType).toBe('unsafe-release')
  })

  it('higher crew-release rating reduces fault even with the same gap', () => {
    const sloppy = evaluateUnsafeRelease(baseInput({
      potentiallyConflictingCars: [makeCar('threat', { zone: 'limit-zone', positionMeters: 38 })],
      conflictingDistanceMeters: 8,
      conflictingClosingSpeedKph: 80,
      releasedCrewRelease: 20,
    }))
    const elite = evaluateUnsafeRelease(baseInput({
      potentiallyConflictingCars: [makeCar('threat', { zone: 'limit-zone', positionMeters: 38 })],
      conflictingDistanceMeters: 8,
      conflictingClosingSpeedKph: 80,
      releasedCrewRelease: 95,
    }))
    expect(sloppy.fault).toBeGreaterThan(elite.fault)
  })

  it('severity scales with how short the gap is', () => {
    const tight = evaluateUnsafeRelease(baseInput({
      potentiallyConflictingCars: [makeCar('threat', { zone: 'limit-zone', positionMeters: 39 })],
      conflictingDistanceMeters: 2,
      conflictingClosingSpeedKph: 80,
      releasedCrewRelease: 30,
      releasedDriverRacecraft: 30,
    }))
    const loose = evaluateUnsafeRelease(baseInput({
      potentiallyConflictingCars: [makeCar('threat', { zone: 'limit-zone', positionMeters: 30 })],
      conflictingDistanceMeters: 12,
      conflictingClosingSpeedKph: 80,
      releasedCrewRelease: 30,
      releasedDriverRacecraft: 30,
    }))
    if (tight.decision && loose.decision) {
      const order: Record<typeof tight.decision.severity, number> = {
        minor: 0, serious: 1, major: 2, egregious: 3,
      }
      expect(order[tight.decision.severity]).toBeGreaterThanOrEqual(order[loose.decision.severity])
    }
  })

  it('clamps fault score to [0, 1]', () => {
    const result = evaluateUnsafeRelease(baseInput({
      potentiallyConflictingCars: [makeCar('threat', { zone: 'limit-zone', positionMeters: 39 })],
      conflictingDistanceMeters: 0.5,
      conflictingClosingSpeedKph: 100,
      releasedCrewRelease: 0,
      releasedDriverRacecraft: 0,
    }))
    expect(result.fault).toBeLessThanOrEqual(1)
    expect(result.fault).toBeGreaterThanOrEqual(0)
  })
})

// ─── evaluatePitLaneSpeeding ──────────────────────────────────────────────────

describe('evaluatePitLaneSpeeding', () => {
  function baseInput(overrides: Partial<PitLaneSpeedingInput> = {}): PitLaneSpeedingInput {
    return {
      driverId: 'd1',
      sampledSpeedKph: 80,
      speedLimitKph: 80,
      speedDiscipline: 70,
      driverExperience: 70,
      ...overrides,
    }
  }

  it('speed at the limit → decision is null', () => {
    expect(evaluatePitLaneSpeeding(baseInput()).decision).toBeNull()
  })

  it('speed at limit + tolerance → decision is null (FIA tolerance respected)', () => {
    expect(evaluatePitLaneSpeeding(baseInput({ sampledSpeedKph: 80.4 })).decision).toBeNull()
  })

  it('speed above limit + tolerance → decision blamed on driver, severity minor', () => {
    const result = evaluatePitLaneSpeeding(baseInput({ sampledSpeedKph: 82 }))
    expect(result.decision).not.toBeNull()
    expect(result.decision!.driverId).toBe('d1')
    expect(result.decision!.offenceType).toBe('pit-lane-speeding')
    expect(result.decision!.severity).toBe('minor')
  })

  it('speed below limit → decision is null regardless of discipline rating', () => {
    expect(evaluatePitLaneSpeeding(baseInput({ sampledSpeedKph: 79, speedDiscipline: 0 })).decision).toBeNull()
    expect(evaluatePitLaneSpeeding(baseInput({ sampledSpeedKph: 79, speedDiscipline: 100 })).decision).toBeNull()
  })
})

// ─── simulatePitLane ──────────────────────────────────────────────────────────

describe('simulatePitLane', () => {
  function carInput(driverId: string, overrides: Partial<PitLaneSimCarInput> = {}): PitLaneSimCarInput {
    return {
      driverId,
      carEntrySpeedKph: 240,
      carExitSpeedKph: 240,
      releaseRating: 70,
      speedDisciplineRating: 70,
      serviceTimeRating: 70,
      driverRacecraft: 70,
      driverExperience: 70,
      ...overrides,
    }
  }

  function baseInput(cars: PitLaneSimCarInput[], overrides: Partial<PitLaneSimInput> = {}): PitLaneSimInput {
    return {
      cars,
      pitLane: STD_LANE,
      pitLossMean: 21,
      pitLossStddev: 1.5,
      calibration: DEFAULT_PENALTY_CALIBRATION,
      ...overrides,
    }
  }

  it('with one car entering, returns one totalLaneSeconds entry and no incidents', () => {
    const rng = createPRNG(1)
    const result = simulatePitLane(baseInput([carInput('d1')]), rng)
    expect(result.timings.d1).toBeGreaterThan(0)
    expect(result.incidents).toEqual([])
  })

  it('produces deterministic output for the same seed', () => {
    const a = simulatePitLane(baseInput([carInput('d1'), carInput('d2')]), createPRNG(42))
    const b = simulatePitLane(baseInput([carInput('d1'), carInput('d2')]), createPRNG(42))
    expect(a).toEqual(b)
  })

  it('PRNG ordering is stable regardless of input order', () => {
    // Same cars in different order should produce the same per-driver timings,
    // because we sort by driverId before consuming PRNG.
    const a = simulatePitLane(baseInput([carInput('zz'), carInput('aa')]), createPRNG(7))
    const b = simulatePitLane(baseInput([carInput('aa'), carInput('zz')]), createPRNG(7))
    expect(a.timings).toEqual(b.timings)
  })

  it('emits no incidents for a single-car stop with neutral ratings', () => {
    const rng = createPRNG(11)
    const result = simulatePitLane(baseInput([carInput('d1')]), rng)
    expect(result.incidents).toHaveLength(0)
  })

  it('low speedDiscipline raises the chance of a speeding incident across many simulations', () => {
    let lowDisciplineHits = 0
    let highDisciplineHits = 0
    for (let seed = 1; seed <= 100; seed++) {
      const lowRng = createPRNG(seed)
      const highRng = createPRNG(seed)
      const lowResult = simulatePitLane(
        baseInput([carInput('d1', { speedDisciplineRating: 10 })]),
        lowRng,
      )
      const highResult = simulatePitLane(
        baseInput([carInput('d1', { speedDisciplineRating: 95 })]),
        highRng,
      )
      if (lowResult.incidents.some((i) => i.type === 'investigation-opened' && i.offenceType === 'pit-lane-speeding')) {
        lowDisciplineHits++
      }
      if (highResult.incidents.some((i) => i.type === 'investigation-opened' && i.offenceType === 'pit-lane-speeding')) {
        highDisciplineHits++
      }
    }
    expect(lowDisciplineHits).toBeGreaterThan(highDisciplineHits)
  })

  it('emits pitLaneEntry / pitLaneExit events for each car', () => {
    const rng = createPRNG(1)
    const result = simulatePitLane(baseInput([carInput('d1'), carInput('d2')]), rng)
    expect(result.events.filter((e) => e.type === 'pitLaneEntry')).toHaveLength(2)
    expect(result.events.filter((e) => e.type === 'pitLaneExit')).toHaveLength(2)
  })

  // ─── Tier C IP-C5: pit-line white-line crossing wiring ───────────────────────
  //
  // The detector itself is unit-tested in pit-line-crossing.test.ts. This test
  // proves the WIRING: a low-experience driver pitting can produce an automatic
  // `penalty-issued` incident (offence `pit-line-crossing`) directly from the
  // sub-sim — no investigation. The crossing rate is deliberately low (base
  // 0.010 entry / 0.014 exit, reduced by experience), so we seed-scan a low-exp
  // driver until one fires and assert the incident shape the race-simulator then
  // finalises (it fills the real lap + the `pl-<lap>-<driverId>-<boundary>` id).
  it('a low-experience driver pitting can produce a pit-line-crossing penalty-issued incident', () => {
    type PenaltyIssuedIncident = Extract<RaceIncident, { type: 'penalty-issued' }>
    let crossing: PenaltyIssuedIncident | null = null
    let firingSeed: number | null = null

    for (let seed = 1; seed <= 1000; seed++) {
      const result = simulatePitLane(baseInput([carInput('d1', { driverExperience: 20 })]), createPRNG(seed))
      const found = result.incidents.find(
        (i): i is PenaltyIssuedIncident =>
          i.type === 'penalty-issued' && i.offenceType === 'pit-line-crossing',
      )
      if (found) {
        crossing = found
        firingSeed = seed
        break
      }
    }

    expect(firingSeed, 'expected a low-experience driver to cross the pit white line within seeds 1–1000').not.toBeNull()
    expect(crossing).not.toBeNull()
    expect(crossing!.type).toBe('penalty-issued')
    expect(crossing!.offenceType).toBe('pit-line-crossing')
    expect(crossing!.driverIds).toEqual(['d1'])
    // Automatic time penalty (minor cell of the matrix): +5s, no super-licence points.
    expect(crossing!.sanction).toBe('5s')
    expect(crossing!.penaltyPointsIssued).toBe(0)
    // Sub-sim emits the partial boundary-tagged id; the race-simulator prefixes
    // the real lap + driverId to produce `pl-<lap>-<driverId>-<boundary>`.
    expect(crossing!.investigationId).toMatch(/^pl-(entry|exit)$/)
  })
})
