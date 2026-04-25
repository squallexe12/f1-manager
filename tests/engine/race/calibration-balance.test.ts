import { describe, it, expect } from 'vitest'
import { simulateRace, type RaceSetup, type RaceDriver } from '@/engine/race/race-simulator'
import { createFallbackProfile } from '@/types/calibration'
import { resolveCalibrationForCircuit } from '@/data/calibration'
import type { Circuit } from '@/types/race'
import type { CalibrationProfile } from '@/types/calibration'

/**
 * IP-07 Task 6 — Balance test harness.
 *
 * Runs the sample circuit N times with and without the OpenF1 calibration
 * profile active, and asserts the distributions don't shift by more than the
 * allowed tolerance. Gated behind CALIBRATION_BALANCE=1 so CI stays fast —
 * run locally via: `CALIBRATION_BALANCE=1 npx vitest run tests/engine/race/calibration-balance.test.ts`
 *
 * Tolerance default is 15% per the plan; revise via CALIBRATION_BALANCE_TOL.
 */

const RUN_HARNESS = process.env.CALIBRATION_BALANCE === '1'
const ITERATIONS = Number(process.env.CALIBRATION_BALANCE_ITERATIONS ?? 100)
const TOLERANCE_PCT = Number(process.env.CALIBRATION_BALANCE_TOL ?? 15) / 100

// Use a high-sample circuit so per-compound stint data is rich.
const SAMPLE_CIRCUIT: Circuit = {
  id: 'bahrain',
  name: 'Bahrain Grand Prix',
  country: 'Bahrain',
  laps: 57,
  downforceLevel: 'medium',
  tireWear: 'high',
  overtakingDifficulty: 'low',
  weatherVariability: 'low',
  sectorCount: 3,
  compounds: ['C1', 'C2', 'C3'],
}

function makeDriverPool(count: number): RaceDriver[] {
  const drivers: RaceDriver[] = []
  for (let i = 0; i < count; i++) {
    drivers.push({
      id: `d${i + 1}`,
      attributes: {
        pace: 80 + (i % 10),
        racecraft: 78 + (i % 9),
        experience: 70 + (i % 8),
        mentality: 75 + (i % 7),
        marketability: 60,
        developmentPotential: 55,
      },
      car: {
        downforce: 85, straightSpeed: 82, reliability: 88,
        tireManagement: 83, braking: 84, cornering: 85,
      },
      mood: { motivation: 50, frustration: 30, confidence: 60 },
    })
  }
  return drivers
}

function buildSetup(calibration: CalibrationProfile | undefined): RaceSetup {
  const drivers = makeDriverPool(20)
  return {
    drivers,
    circuit: {
      id: SAMPLE_CIRCUIT.id,
      name: SAMPLE_CIRCUIT.name,
      laps: SAMPLE_CIRCUIT.laps,
      tireWear: SAMPLE_CIRCUIT.tireWear,
      overtakingDifficulty: SAMPLE_CIRCUIT.overtakingDifficulty,
      weatherVariability: SAMPLE_CIRCUIT.weatherVariability,
      compounds: SAMPLE_CIRCUIT.compounds,
    },
    strategies: drivers.map((d) => ({
      driverId: d.id,
      plannedStops: [{ lap: 22, compound: 'C2' as const }],
      currentCommand: 'standard' as const,
    })),
    weather: 'dry',
    gridOrder: drivers.map((d) => d.id),
    calibration,
  }
}

interface DistributionStats {
  meanLapTime: number
  meanFirstPitLap: number
  winRateByDriver: Record<string, number>
}

function runDistribution(setup: RaceSetup, iterations: number): DistributionStats {
  let totalLapTime = 0
  let totalLapTimeSamples = 0
  let totalFirstPit = 0
  let totalFirstPitSamples = 0
  const winCounts: Record<string, number> = {}

  for (let i = 0; i < iterations; i++) {
    const result = simulateRace(setup, 1000 + i)

    for (const lap of result.lapData) {
      for (const r of lap) {
        if (Number.isFinite(r.lapTime) && r.lapTime > 0) {
          totalLapTime += r.lapTime
          totalLapTimeSamples++
        }
      }
    }

    // First pit lap across all drivers this race
    for (const driverId of setup.drivers.map((d) => d.id)) {
      for (let lapIdx = 0; lapIdx < result.lapData.length; lapIdx++) {
        const entry = result.lapData[lapIdx].find((e) => e.driverId === driverId)
        if (entry?.pitted) {
          totalFirstPit += lapIdx + 1
          totalFirstPitSamples++
          break
        }
      }
    }

    const winner = result.finalPositions[0]
    if (winner) {
      winCounts[winner] = (winCounts[winner] ?? 0) + 1
    }
  }

  const winRateByDriver: Record<string, number> = {}
  for (const [driverId, count] of Object.entries(winCounts)) {
    winRateByDriver[driverId] = count / iterations
  }

  return {
    meanLapTime: totalLapTimeSamples > 0 ? totalLapTime / totalLapTimeSamples : 0,
    meanFirstPitLap: totalFirstPitSamples > 0 ? totalFirstPit / totalFirstPitSamples : 0,
    winRateByDriver,
  }
}

function percentDelta(a: number, b: number): number {
  if (a === 0 && b === 0) return 0
  const base = Math.max(Math.abs(a), Math.abs(b))
  if (base === 0) return 0
  return Math.abs(a - b) / base
}

describe.skipIf(!RUN_HARNESS)('calibration balance harness (CALIBRATION_BALANCE=1)', () => {
  it(`sample circuit distributions shift by no more than ${(TOLERANCE_PCT * 100).toFixed(0)}% when the OpenF1 profile is active`, () => {
    const fallback = createFallbackProfile(SAMPLE_CIRCUIT.id)
    const openF1 = resolveCalibrationForCircuit(SAMPLE_CIRCUIT)

    const withProfile = runDistribution(buildSetup(openF1), ITERATIONS)
    const withoutProfile = runDistribution(buildSetup(fallback), ITERATIONS)

    const lapTimeShift = percentDelta(withProfile.meanLapTime, withoutProfile.meanLapTime)
    const pitLapShift = percentDelta(withProfile.meanFirstPitLap, withoutProfile.meanFirstPitLap)

    expect(lapTimeShift, `mean lap time shifted ${(lapTimeShift * 100).toFixed(1)}%`).toBeLessThanOrEqual(
      TOLERANCE_PCT,
    )
    expect(pitLapShift, `mean first pit lap shifted ${(pitLapShift * 100).toFixed(1)}%`).toBeLessThanOrEqual(
      TOLERANCE_PCT,
    )

    // Win probability: no single driver should swing more than 2x the
    // tolerance between the two profiles, otherwise calibration is changing
    // the competitive order materially.
    const allDrivers = new Set([
      ...Object.keys(withProfile.winRateByDriver),
      ...Object.keys(withoutProfile.winRateByDriver),
    ])
    for (const driverId of allDrivers) {
      const a = withProfile.winRateByDriver[driverId] ?? 0
      const b = withoutProfile.winRateByDriver[driverId] ?? 0
      const delta = Math.abs(a - b)
      expect(
        delta,
        `${driverId} win rate shifted ${(delta * 100).toFixed(1)} pts (calibration vs fallback)`,
      ).toBeLessThanOrEqual(TOLERANCE_PCT * 2)
    }
  })
})

// Cheap sanity test that always runs — confirms the harness compiles and
// the helper functions return well-typed stats. The full 100×2 run is gated.
describe('calibration balance harness helpers', () => {
  it('percentDelta is 0 for identical values and positive otherwise', () => {
    expect(percentDelta(100, 100)).toBe(0)
    expect(percentDelta(100, 110)).toBeGreaterThan(0)
  })

  it('percentDelta handles zero inputs without NaN', () => {
    expect(Number.isFinite(percentDelta(0, 0))).toBe(true)
    expect(Number.isFinite(percentDelta(0, 5))).toBe(true)
    expect(Number.isFinite(percentDelta(5, 0))).toBe(true)
  })

  it('runDistribution returns stats shaped as expected for a single iteration', () => {
    const stats = runDistribution(buildSetup(createFallbackProfile(SAMPLE_CIRCUIT.id)), 1)
    expect(stats.meanLapTime).toBeGreaterThan(0)
    expect(stats.meanFirstPitLap).toBeGreaterThanOrEqual(0)
    expect(typeof stats.winRateByDriver).toBe('object')
  })
})
