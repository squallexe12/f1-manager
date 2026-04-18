import { describe, it, expect } from 'vitest'
import { simulateLap, simulateRace, type SimRaceState, type RaceSetup } from '@/engine/race/race-simulator'
import { createPRNG } from '@/engine/core/prng'
import type { TireCompound, RaceStrategy } from '@/types/race'
import { createFallbackProfile } from '@/types/calibration'

function mockDrivers() {
  return [
    { id: 'd1', car: { downforce: 80, straightSpeed: 80, reliability: 80, tireManagement: 80, braking: 80, cornering: 80 }, attributes: { pace: 85, racecraft: 80, experience: 75, mentality: 80, marketability: 70, developmentPotential: 60 } },
    { id: 'd2', car: { downforce: 78, straightSpeed: 78, reliability: 78, tireManagement: 78, braking: 78, cornering: 78 }, attributes: { pace: 80, racecraft: 78, experience: 70, mentality: 75, marketability: 65, developmentPotential: 70 } },
    { id: 'd3', car: { downforce: 75, straightSpeed: 82, reliability: 75, tireManagement: 75, braking: 75, cornering: 75 }, attributes: { pace: 78, racecraft: 82, experience: 80, mentality: 78, marketability: 60, developmentPotential: 40 } },
    { id: 'd4', car: { downforce: 72, straightSpeed: 72, reliability: 85, tireManagement: 72, braking: 72, cornering: 72 }, attributes: { pace: 72, racecraft: 70, experience: 60, mentality: 70, marketability: 55, developmentPotential: 85 } },
  ]
}

function mockStrategies(drivers: { id: string }[]): RaceStrategy[] {
  return drivers.map(d => ({
    driverId: d.id,
    plannedStops: [{ lap: 25, compound: 'C3' as TireCompound }],
    currentCommand: 'standard' as const,
  }))
}

function mockRaceState(): SimRaceState {
  const drivers = mockDrivers()
  return {
    currentLap: 10,
    totalLaps: 55,
    weather: { current: 'dry', rainProbability: 0.1, changeInLaps: null },
    safetyCar: 'green',
    trackTemp: 38,
    results: [],
    incidents: [],
    commentary: [],
    drivers,
    circuit: { tireWear: 'medium', overtakingDifficulty: 'medium', weatherVariability: 'low' },
    calibration: createFallbackProfile('test-circuit'),
    strategies: mockStrategies(drivers),
    tireStates: Object.fromEntries(drivers.map(d => [d.id, { compound: 'C3' as TireCompound, label: 'medium' as const, wear: 72, lapsFitted: 10 }])),
    positions: drivers.map(d => d.id),
  }
}

function mockRaceSetup(): RaceSetup {
  const drivers = mockDrivers()
  return {
    drivers,
    circuit: {
      id: 'monza', name: 'Monza', laps: 20,
      tireWear: 'medium', overtakingDifficulty: 'medium', weatherVariability: 'low',
      compounds: ['C2', 'C3', 'C4'],
    },
    strategies: mockStrategies(drivers),
    weather: 'dry',
    gridOrder: drivers.map(d => d.id),
  }
}

describe('race simulator', () => {
  it('simulateLap produces results for all drivers', () => {
    const rng = createPRNG(42)
    const state = mockRaceState()
    const result = simulateLap(state, rng)
    expect(result.lapResults).toHaveLength(4)
  })

  it('race simulation is deterministic with same seed', () => {
    const result1 = simulateRace(mockRaceSetup(), 42)
    const result2 = simulateRace(mockRaceSetup(), 42)
    expect(result1.finalPositions).toEqual(result2.finalPositions)
  })

  it('driver commands affect lap times', () => {
    const rng = createPRNG(42)
    const state = mockRaceState()
    state.strategies[0].currentCommand = 'push'
    const pushResult = simulateLap(state, rng)

    const rng2 = createPRNG(42)
    const state2 = mockRaceState()
    state2.strategies[0].currentCommand = 'conserve'
    const conserveResult = simulateLap(state2, rng2)

    expect(pushResult.lapResults[0].lapTime).toBeLessThan(conserveResult.lapResults[0].lapTime)
  })
})
