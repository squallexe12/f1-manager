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
    cumulativeTimes: Object.fromEntries(drivers.map(d => [d.id, 0])),
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

  it('auto-triggers planned pit stop when currentLap reaches plannedStops[0].lap', () => {
    const rng = createPRNG(42)
    const state = mockRaceState()
    // circuit.compounds needed so the pit branch can resolve the tire label
    state.circuit.compounds = ['C2', 'C3', 'C4']
    // Driver d1 has a planned stop on lap 25 for C3; currentLap is 10. Advance to 25.
    state.currentLap = 25
    state.strategies[0].plannedStops = [{ lap: 25, compound: 'C3' }]
    state.strategies[0].currentCommand = 'standard'

    const result = simulateLap(state, rng)
    const d1Result = result.lapResults.find(r => r.driverId === 'd1')!

    expect(d1Result.pitted).toBe(true)
    expect(state.tireStates['d1'].compound).toBe('C3')
    expect(state.tireStates['d1'].wear).toBe(100)
    expect(state.strategies[0].plannedStops).toHaveLength(0)
  })

  it('does not auto-pit on laps before the planned stop', () => {
    const rng = createPRNG(42)
    const state = mockRaceState()
    state.circuit.compounds = ['C2', 'C3', 'C4']
    state.currentLap = 20 // before planned lap 25
    state.strategies[0].plannedStops = [{ lap: 25, compound: 'C3' }]
    state.strategies[0].currentCommand = 'standard'

    const result = simulateLap(state, rng)
    const d1Result = result.lapResults.find(r => r.driverId === 'd1')!

    expect(d1Result.pitted).toBe(false)
    expect(state.strategies[0].plannedStops).toHaveLength(1)
  })

  it('applies per-circuit pit-loss calibration instead of a hardcoded penalty', () => {
    // Two identical scenarios that differ only by calibration.pitLoss.meanLossSeconds.
    // The pit-lap time delta must equal the calibration delta — proving the
    // simulator consumes the OpenF1-derived pit-loss value rather than a constant.
    const setupState = (meanLoss: number): SimRaceState => {
      const state = mockRaceState()
      state.circuit.compounds = ['C2', 'C3', 'C4']
      state.currentLap = 25
      state.strategies[0].plannedStops = [{ lap: 25, compound: 'C3' }]
      state.strategies[0].currentCommand = 'pit'
      state.calibration = {
        ...state.calibration,
        pitLoss: { meanLossSeconds: meanLoss, stddevSeconds: 0, sampleCount: 1 },
      }
      return state
    }

    const rngA = createPRNG(42)
    const resultA = simulateLap(setupState(21), rngA)
    const rngB = createPRNG(42)
    const resultB = simulateLap(setupState(30), rngB)

    const d1A = resultA.lapResults.find(r => r.driverId === 'd1')!
    const d1B = resultB.lapResults.find(r => r.driverId === 'd1')!

    expect(d1A.pitted).toBe(true)
    expect(d1B.pitted).toBe(true)
    expect(d1B.lapTime - d1A.lapTime).toBeCloseTo(9, 5)
  })

  it('pit-loss scatter uses Gaussian distribution (variance matches stddev squared)', () => {
    // Regression: scatter was `rng.range(-σ, σ)` (uniform on [-σ, +σ]), whose
    // realized stddev is σ/√3 ≈ 0.577σ — understating calibrated variance by
    // ~42% and hard-capping at ±σ. With a proper Gaussian sampler the sample
    // stddev of N pit-lap times should converge on the calibrated σ.
    const SAMPLES = 400
    const MEAN = 22
    const STDDEV = 4
    const pitTimes: number[] = []
    for (let seed = 0; seed < SAMPLES; seed++) {
      const rng = createPRNG(seed * 997 + 13)
      const state = mockRaceState()
      state.circuit.compounds = ['C2', 'C3', 'C4']
      state.currentLap = 25
      state.strategies[0].plannedStops = [{ lap: 25, compound: 'C3' }]
      state.strategies[0].currentCommand = 'pit'
      state.calibration = {
        ...state.calibration,
        pitLoss: { meanLossSeconds: MEAN, stddevSeconds: STDDEV, sampleCount: 200 },
      }
      const res = simulateLap(state, rng)
      const d1 = res.lapResults.find(r => r.driverId === 'd1')!
      expect(d1.pitted).toBe(true)
      pitTimes.push(d1.lapTime)
    }
    const mean = pitTimes.reduce((a, b) => a + b, 0) / pitTimes.length
    const variance =
      pitTimes.reduce((a, t) => a + (t - mean) * (t - mean), 0) / (pitTimes.length - 1)
    const sampleStddev = Math.sqrt(variance)
    // Pit-lap time includes the base lap (~90s) + Gaussian pit penalty (~22s, σ=4s)
    // + ±0.3s base lap noise. The dominant variance component is the pit scatter,
    // so sample stddev should be close to σ=4. A uniform sampler would give
    // σ/√3 ≈ 2.31. Tolerance is generous to absorb base-lap noise.
    expect(sampleStddev).toBeGreaterThan(3.0)
    expect(sampleStddev).toBeLessThan(5.0)
  })

  it('overtake gate blocks position swaps when probability is zero', () => {
    // Regression: after the cumulative-time refactor, the overtake probability
    // check gated only commentary — positions were re-ordered purely by a
    // cumulative-time sort. That made circuit difficulty / racecraft / tire
    // delta irrelevant to position changes. With the gate restored, an
    // overtakeModifier of 0 must prevent swaps even when cumulative would
    // invert (the blocked driver stays stuck behind).
    const rng = createPRNG(42)
    const state = mockRaceState()
    // Impossible-to-pass circuit: probability clamps to 0.
    state.calibration = {
      ...state.calibration,
      overtake: { overtakeModifier: 0, drsEffectiveness: 0 },
    }
    // Set d2 just behind d1 on cumulative, and force a large lap delta so the
    // gate would otherwise fire. With modifier=0, probability=0, gate fails,
    // d2 is pinned behind d1.
    state.cumulativeTimes = { d1: 100, d2: 99.99, d3: 101, d4: 102 }
    // Buff d2's car so they post a much faster lap than d1.
    state.drivers[1] = {
      ...state.drivers[1],
      car: { ...state.drivers[1].car, downforce: 100, straightSpeed: 100, braking: 100, cornering: 100 },
      attributes: { ...state.drivers[1].attributes, pace: 100 },
    }
    // Nerf d1's car so they post a much slower lap.
    state.drivers[0] = {
      ...state.drivers[0],
      car: { ...state.drivers[0].car, downforce: 30, straightSpeed: 30, braking: 30, cornering: 30 },
      attributes: { ...state.drivers[0].attributes, pace: 30 },
    }

    simulateLap(state, rng)

    // Positions must preserve prior order — d2 could not pass d1.
    expect(state.positions.indexOf('d1')).toBeLessThan(state.positions.indexOf('d2'))
    // Cumulative was pinned, so d2 is just behind d1 (within epsilon of
    // throttle). Lap time itself was fast, but the gate blocked the overtake.
    expect(state.cumulativeTimes.d2).toBeGreaterThan(state.cumulativeTimes.d1)
  })

  it('pit loss persists in gap-to-leader on subsequent non-pit laps', () => {
    // A pit stop on lap N must remain visible as accumulated time loss on
    // lap N+1, N+2, ... — otherwise the driver "continues as usual".
    const rng = createPRNG(42)
    const state = mockRaceState()
    state.circuit.compounds = ['C2', 'C3', 'C4']
    state.calibration = {
      ...state.calibration,
      pitLoss: { meanLossSeconds: 25, stddevSeconds: 0, sampleCount: 1 },
    }
    // Force d1 to pit on lap 25 while d2/d3/d4 stay out.
    state.currentLap = 25
    state.strategies[0].plannedStops = [{ lap: 25, compound: 'C3' }]
    state.strategies[0].currentCommand = 'standard'
    for (let i = 1; i < state.strategies.length; i++) {
      state.strategies[i].plannedStops = []
      state.strategies[i].currentCommand = 'standard'
    }

    simulateLap(state, rng) // pit lap
    const d1AfterPit = state.cumulativeTimes['d1']
    const d2AfterPit = state.cumulativeTimes['d2']
    const pitLapGap = d1AfterPit - d2AfterPit
    expect(pitLapGap).toBeGreaterThan(20) // pit loss now baked into cumulative

    // Two more clean laps. Cumulative gap must persist (within normal lap variance).
    state.currentLap = 26
    simulateLap(state, rng)
    state.currentLap = 27
    simulateLap(state, rng)

    const finalGap = state.cumulativeTimes['d1'] - state.cumulativeTimes['d2']
    expect(finalGap).toBeGreaterThan(15)
  })
})
