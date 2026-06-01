import { describe, it, expect } from 'vitest'
import { simulateLap, simulateRace, applyRaceEndFold, type SimRaceState, type RaceSetup } from '@/engine/race/race-simulator'
import { createPRNG } from '@/engine/core/prng'
import type { TireCompound, RaceStrategy, LapResult, TireState } from '@/types/race'
import { createFallbackProfile } from '@/types/calibration'
import { DEFAULT_RACE_INCIDENT_CONFIG, type RaceIncidentConfig } from '@/engine/race/race-incidents'

function mockDrivers() {
  const mood = { motivation: 50, frustration: 30, confidence: 60 }
  return [
    { id: 'd1', shortName: 'D1', teamId: 't1', car: { downforce: 80, straightSpeed: 80, reliability: 80, tireManagement: 80, braking: 80, cornering: 80 }, attributes: { pace: 85, racecraft: 80, experience: 75, mentality: 80, marketability: 70, developmentPotential: 60 }, mood: { ...mood } },
    { id: 'd2', shortName: 'D2', teamId: 't2', car: { downforce: 78, straightSpeed: 78, reliability: 78, tireManagement: 78, braking: 78, cornering: 78 }, attributes: { pace: 80, racecraft: 78, experience: 70, mentality: 75, marketability: 65, developmentPotential: 70 }, mood: { ...mood } },
    { id: 'd3', shortName: 'D3', teamId: 't3', car: { downforce: 75, straightSpeed: 82, reliability: 75, tireManagement: 75, braking: 75, cornering: 75 }, attributes: { pace: 78, racecraft: 82, experience: 80, mentality: 78, marketability: 60, developmentPotential: 40 }, mood: { ...mood } },
    { id: 'd4', shortName: 'D4', teamId: 't4', car: { downforce: 72, straightSpeed: 72, reliability: 85, tireManagement: 72, braking: 72, cornering: 72 }, attributes: { pace: 72, racecraft: 70, experience: 60, mentality: 70, marketability: 55, developmentPotential: 85 }, mood: { ...mood } },
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
    cautionLapsRemaining: 0,
    raceSeed: 1234,
    trackLimitStrikes: {},
    trackTemp: 38,
    results: [],
    incidents: [],
    commentary: [],
    drivers,
    circuit: { id: 'silverstone', tireWear: 'medium', overtakingDifficulty: 'medium', weatherVariability: 'low' },
    calibration: createFallbackProfile('test-circuit'),
    strategies: mockStrategies(drivers),
    tireStates: Object.fromEntries(drivers.map(d => [d.id, { compound: 'C3' as TireCompound, label: 'medium' as const, wear: 72, lapsFitted: 10 }])),
    positions: drivers.map(d => d.id),
    cumulativeTimes: Object.fromEntries(drivers.map(d => [d.id, 0])),
    pendingInvestigations: [],
    pendingTimePenalties: {},
    appliedPenaltiesByDriver: {},
    sanctionDeadlines: {},
    dnfDriverIds: {},
    teamCrews: {},
    radioFlags: {
      tireComplainedThisStint: {},
      weatherTransitionAnnounced: false,
      fastestLapAnnouncedTime: Infinity,
      finalLapAnnouncedFor: {},
      lightsOutAnnounced: false,
    },
    playerTeamId: undefined,
    playerDriverIds: [],
    championshipRivalIds: [],
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

/**
 * Variant of `mockRaceSetup` that wires player metadata so radio curation
 * (`isBroadcastWorthy`) admits the player + rival categories. The fixture's
 * synthetic driver/team IDs (`d1..d4` / `t1..t4`) are used as-is. Strategies
 * are widened to two planned stops per driver so the radio volume test sees
 * a realistic mix of pit pairs, lights-out, final-lap, and fastest-lap radio.
 */
function mockRadioRaceSetup(): RaceSetup {
  const base = mockRaceSetup()
  const strategies: RaceStrategy[] = base.drivers.map((d, idx) => ({
    driverId: d.id,
    plannedStops: [
      { lap: 18 + idx, compound: 'C3' as TireCompound },
      { lap: 36 + idx, compound: 'C4' as TireCompound },
    ],
    currentCommand: 'standard' as const,
  }))
  return {
    ...base,
    strategies,
    playerTeamId: 't1',
    playerDriverIds: ['d1'],
    championshipRivalIds: ['d2', 'd3'],
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

  it('pit branch consumes pendingTimePenalties and zeros the entry', () => {
    const SEED = 42
    const buildPitState = (): SimRaceState => {
      const state = mockRaceState()
      state.circuit.compounds = ['C2', 'C3', 'C4']
      state.currentLap = 25
      // d1 will pit this lap
      state.strategies[0].plannedStops = [{ lap: 25, compound: 'C3' }]
      state.strategies[0].currentCommand = 'standard'
      // Use zero stddev so scatter is 0 and lap time differences are exact
      state.calibration = {
        ...state.calibration,
        pitLoss: { meanLossSeconds: 22, stddevSeconds: 0, sampleCount: 1 },
      }
      return state
    }

    // Baseline: no pending penalty
    const baseState = buildPitState()
    baseState.pendingTimePenalties = {}
    const baseResult = simulateLap(baseState, createPRNG(SEED))
    const baseD1 = baseResult.lapResults.find(r => r.driverId === 'd1')!

    // Penalty run: 5s pending for d1
    const penState = buildPitState()
    penState.pendingTimePenalties = { d1: 5 }
    const penResult = simulateLap(penState, createPRNG(SEED))
    const penD1 = penResult.lapResults.find(r => r.driverId === 'd1')!

    // Both must have pitted
    expect(baseD1.pitted).toBe(true)
    expect(penD1.pitted).toBe(true)

    // Penalty lap time must be exactly 5s more than baseline
    expect(penD1.lapTime - baseD1.lapTime).toBeCloseTo(5, 4)

    // Penalty entry must be zeroed after consumption
    expect(penState.pendingTimePenalties['d1']).toBe(0)
  })

  it('contested overtake with reckless attacker opens an investigation', () => {
    // Attacker (d2) is placed directly behind lead (d1) in positions.
    // Attacker attributes: racecraft=30, experience=20, command='overtake'.
    // Computed attacker fault ≈ 0.71 > faultThreshold 0.55 → investigation must open.
    // To force the overtake gate to fire, we set cumulative times so d2 is
    // behind in positions but would invert this lap (cumBehind < cumAhead).
    // We give d2 a superior car so it posts a fast lap time, then pre-set
    // cumulativeTimes to trigger the gate on the first lap.
    const SEED = 42
    const state = mockRaceState()
    state.circuit.overtakingDifficulty = 'high'
    state.circuit.compounds = ['C2', 'C3', 'C4'] as [TireCompound, TireCompound, TireCompound]

    // Two-driver state: lead (d1) and attacker (d2)
    state.drivers = [
      {
        id: 'd1',
        shortName: 'D1',
        teamId: 't1',
        car: { downforce: 80, straightSpeed: 80, reliability: 80, tireManagement: 80, braking: 80, cornering: 80 },
        attributes: { pace: 80, racecraft: 80, experience: 75, mentality: 80, marketability: 70, developmentPotential: 60 },
        mood: { motivation: 50, frustration: 30, confidence: 60 },
      },
      {
        id: 'd2',
        shortName: 'D2',
        teamId: 't2',
        car: { downforce: 90, straightSpeed: 90, reliability: 90, tireManagement: 90, braking: 90, cornering: 90 },
        attributes: { pace: 90, racecraft: 30, experience: 20, mentality: 80, marketability: 70, developmentPotential: 60 },
        mood: { motivation: 50, frustration: 30, confidence: 60 },
      },
    ]
    state.positions = ['d1', 'd2']
    // Pre-seed cumulative times so d2 is close behind d1. After this lap d2's
    // superior car will post a faster lap, making cumBehind < cumAhead and
    // triggering the contested gate.
    state.cumulativeTimes = { d1: 900, d2: 899.0 }
    state.tireStates = {
      d1: { compound: 'C3' as TireCompound, label: 'medium' as const, wear: 40, lapsFitted: 20 },
      d2: { compound: 'C3' as TireCompound, label: 'medium' as const, wear: 80, lapsFitted: 5 },
    }
    state.strategies = [
      { driverId: 'd1', plannedStops: [], currentCommand: 'standard' as const },
      { driverId: 'd2', plannedStops: [], currentCommand: 'overtake' as const },
    ]

    const rng = createPRNG(SEED)
    const result = simulateLap(state, rng)

    const investigationOpened = result.incidents.some(
      (inc) => inc.type === 'investigation-opened',
    )
    expect(investigationOpened).toBe(true)
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

describe('race incidents — determinism & separation', () => {
  const ZERO_HAZARD: RaceIncidentConfig = {
    ...DEFAULT_RACE_INCIDENT_CONFIG,
    crashBaseHazard: 0,
    mechanicalBaseHazard: 0,
  }

  it('main simulation stream is unperturbed when the incident layer is off (zero hazard)', () => {
    // The incident PRNG is separate; with hazards zeroed no incident fires, no
    // caution deploys, and the flag-state block stays dormant — so the lap-time
    // / position / existing-incident stream is byte-identical run-to-run and
    // contains NO incident-layer incidents. This proves the additive-separate-
    // stream claim (the only allowed delta vs. pre-workstream is the removed
    // contested→caution roll, which standard commands never fired).
    const setup: RaceSetup = { ...mockRaceSetup(), incidentConfig: ZERO_HAZARD }
    const run1 = simulateRace(setup, 42)
    const run2 = simulateRace(setup, 42)
    expect(run1.lapData).toEqual(run2.lapData)
    expect(run1.finalPositions).toEqual(run2.finalPositions)
    const types = run1.incidents.map((i) => i.type)
    expect(types).not.toContain('crash')
    expect(types).not.toContain('mechanical')
    expect(types).not.toContain('safety-car')
  })

  it('crash/mechanical/safety-car incident stream is byte-identical across two seeded runs', () => {
    // Low reliability + low racecraft over a long race so incidents reproducibly
    // fire. Two-run equality proves the per-lap incident PRNG is deterministic.
    const riskySetup: RaceSetup = {
      drivers: [
        { id: 'd1', shortName: 'D1', teamId: 't1', car: { downforce: 70, straightSpeed: 70, reliability: 35, tireManagement: 70, braking: 70, cornering: 70 }, attributes: { pace: 70, racecraft: 25, experience: 25, mentality: 60, marketability: 60, developmentPotential: 60 }, mood: { motivation: 50, frustration: 90, confidence: 50 } },
        { id: 'd2', shortName: 'D2', teamId: 't2', car: { downforce: 70, straightSpeed: 70, reliability: 35, tireManagement: 70, braking: 70, cornering: 70 }, attributes: { pace: 70, racecraft: 25, experience: 25, mentality: 60, marketability: 60, developmentPotential: 60 }, mood: { motivation: 50, frustration: 90, confidence: 50 } },
      ],
      circuit: { id: 'monza', name: 'Monza', laps: 60, tireWear: 'medium', overtakingDifficulty: 'medium', weatherVariability: 'low', compounds: ['C2', 'C3', 'C4'] },
      strategies: [
        { driverId: 'd1', plannedStops: [], currentCommand: 'standard' },
        { driverId: 'd2', plannedStops: [], currentCommand: 'standard' },
      ],
      weather: 'dry',
      gridOrder: ['d1', 'd2'],
    }
    const incidentStream = (r: ReturnType<typeof simulateRace>) =>
      r.incidents.filter((i) => i.type === 'crash' || i.type === 'mechanical' || i.type === 'safety-car')

    // Find a seed that reproducibly fires at least one incident (mirrors the
    // IP-C3 seed-scan precedent — pin the discovered seed in a comment after the
    // first local run for documentation, but the scan itself stays in the test).
    let firedSeed = -1
    let firedRun: ReturnType<typeof simulateRace> | null = null
    for (let s = 1; s <= 1000; s++) {
      const r = simulateRace(riskySetup, s)
      if (incidentStream(r).length > 0) { firedSeed = s; firedRun = r; break }
    }
    expect(firedSeed, 'expected a seed in 1..1000 to fire ≥1 race incident').toBeGreaterThan(0)
    const rerun = simulateRace(riskySetup, firedSeed)
    expect(incidentStream(rerun)).toEqual(incidentStream(firedRun!))
  })

  it('a crash/mechanical writes a real DNF (a retired driver has only a retired row on later laps)', () => {
    const riskySetup: RaceSetup = {
      drivers: [
        { id: 'd1', shortName: 'D1', teamId: 't1', car: { downforce: 70, straightSpeed: 70, reliability: 20, tireManagement: 70, braking: 70, cornering: 70 }, attributes: { pace: 70, racecraft: 20, experience: 20, mentality: 60, marketability: 60, developmentPotential: 60 }, mood: { motivation: 50, frustration: 95, confidence: 50 } },
        { id: 'd2', shortName: 'D2', teamId: 't2', car: { downforce: 70, straightSpeed: 70, reliability: 99, tireManagement: 70, braking: 70, cornering: 70 }, attributes: { pace: 70, racecraft: 95, experience: 95, mentality: 90, marketability: 60, developmentPotential: 60 }, mood: { motivation: 50, frustration: 5, confidence: 90 } },
      ],
      circuit: { id: 'monza', name: 'Monza', laps: 60, tireWear: 'medium', overtakingDifficulty: 'medium', weatherVariability: 'low', compounds: ['C2', 'C3', 'C4'] },
      strategies: [
        { driverId: 'd1', plannedStops: [], currentCommand: 'standard' },
        { driverId: 'd2', plannedStops: [], currentCommand: 'standard' },
      ],
      weather: 'dry',
      gridOrder: ['d1', 'd2'],
    }
    // Scan for a seed where the high-risk d1 retires; assert it stops appearing.
    for (let s = 1; s <= 1000; s++) {
      const r = simulateRace(riskySetup, s)
      const dnf = r.incidents.find((i) => (i.type === 'crash' || i.type === 'mechanical') && i.driverIds.includes('d1'))
      if (!dnf) continue
      const retireLap = dnf.lap
      // On a later lap, d1 now carries ONLY a retired RET row (no running row).
      const laterLap = r.lapData[retireLap] // 0-indexed: the lap AFTER retireLap
      if (laterLap) {
        const d1Rows = laterLap.filter((lr) => lr.driverId === 'd1')
        // No running (retired:false) d1 row on later laps.
        expect(d1Rows.some((lr) => !lr.retired)).toBe(false)
        // The d1 row present on later laps is a retired RET row (lapTime 0).
        expect(d1Rows.length).toBe(1)
        expect(d1Rows[0].retired).toBe(true)
        expect(d1Rows[0].lapTime).toBe(0)
      }
      return
    }
    throw new Error('expected a seed in 1..1000 to retire d1')
  })

  it('IP-4: an unsafe rejoin deploys a caution end-to-end with the incident layer OFF (IP-C3 dead-store fix)', () => {
    // The IP-C3 rejoin caution trigger was a DEAD STORE before this workstream
    // (seriousIncidentThisLap was set AFTER advanceRaceFlags had already run).
    // IP-2 wired it into the end-of-lap arbiter via `cautionWorthyRejoinThisLap`.
    // With crash + mechanical hazards ZEROED, the ONLY remaining caution source
    // is a major/egregious unsafe rejoin -> a 'safety-car' incident here proves
    // the rejoin path deploys a caution end-to-end (no crash/mechanical possible).
    const recklessSilverstone: RaceSetup = {
      drivers: [
        { id: 'd1', shortName: 'D1', teamId: 't1', car: { downforce: 80, straightSpeed: 80, reliability: 99, tireManagement: 80, braking: 80, cornering: 80 }, attributes: { pace: 80, racecraft: 25, experience: 20, mentality: 80, marketability: 70, developmentPotential: 60 }, mood: { motivation: 50, frustration: 95, confidence: 60 } },
        { id: 'd2', shortName: 'D2', teamId: 't2', car: { downforce: 80, straightSpeed: 80, reliability: 99, tireManagement: 80, braking: 80, cornering: 80 }, attributes: { pace: 80, racecraft: 25, experience: 20, mentality: 80, marketability: 70, developmentPotential: 60 }, mood: { motivation: 50, frustration: 95, confidence: 60 } },
      ],
      circuit: { id: 'silverstone', name: 'British Grand Prix', laps: 52, tireWear: 'low', overtakingDifficulty: 'low', weatherVariability: 'low', compounds: ['C3', 'C4', 'C5'] },
      strategies: [
        { driverId: 'd1', plannedStops: [], currentCommand: 'standard' },
        { driverId: 'd2', plannedStops: [], currentCommand: 'standard' },
      ],
      weather: 'dry',
      gridOrder: ['d1', 'd2'],
      calibration: { ...createFallbackProfile('silverstone'), overtake: { overtakeModifier: 0.3, drsEffectiveness: 0.3 } },
      incidentConfig: ZERO_HAZARD,
    }

    const safetyCars = (r: ReturnType<typeof simulateRace>) => r.incidents.filter((i) => i.type === 'safety-car')
    const crashMech = (r: ReturnType<typeof simulateRace>) => r.incidents.filter((i) => i.type === 'crash' || i.type === 'mechanical')
    const rejoinInvs = (r: ReturnType<typeof simulateRace>) =>
      r.incidents.filter((i) => i.type === 'investigation-opened' && 'offenceType' in i && i.offenceType === 'rejoin-collision')

    // Seed scan: a major/egregious rejoin from green ALWAYS deploys a flag (the
    // arbiter receives a non-null 'minor' trigger), which emits a 'safety-car'
    // incident regardless of the band rolled. Find the first such race.
    let firedSeed = -1
    let firedRun: ReturnType<typeof simulateRace> | null = null
    for (let s = 1; s <= 1500; s++) {
      const r = simulateRace(recklessSilverstone, s)
      if (safetyCars(r).length > 0) { firedSeed = s; firedRun = r; break }
    }
    expect(firedSeed, 'expected a seed in 1..1500 where an unsafe rejoin deploys a caution (incident layer off)').toBeGreaterThan(0)
    // Incident layer off -> NO crash/mechanical incident can exist, so the caution
    // MUST have come from the rejoin path (this is the dead-store-fix proof).
    expect(crashMech(firedRun!), 'no crash/mechanical incidents may exist with the incident layer zeroed').toEqual([])
    // A rejoin-collision investigation must accompany the caution (its source).
    expect(rejoinInvs(firedRun!).length, 'the deploying race must contain a rejoin-collision investigation').toBeGreaterThan(0)
    // Determinism: same seed -> byte-identical safety-car stream.
    const rerun = simulateRace(recklessSilverstone, firedSeed)
    expect(safetyCars(rerun)).toEqual(safetyCars(firedRun!))
  })

  it('IP-4 (N->N+1): a caution deployed at end-of-lap N enforces NO flag offence on lap N; the flag is live from N+1', () => {
    // IP-2 relocated advanceRaceFlags to the END of simulateLap. The flag-state
    // offence block reads state.safetyCar at LAP START, so a caution that deploys
    // at end-of-lap N is invisible to that block on lap N and first enforced on
    // lap N+1. A regression moving advanceRaceFlags back ahead of the flag-offence
    // block would let offences fire on the deploy lap -> this pins the ordering.
    const FLAG_OFFENCE_TYPES = new Set(['yellow-flag-breach', 'sc-infraction', 'vsc-infraction', 'red-flag-breach'])
    const flagOffenceCount = (incidents: ReturnType<typeof simulateLap>['incidents']) =>
      incidents.filter((i) => 'offenceType' in i && i.offenceType && FLAG_OFFENCE_TYPES.has(i.offenceType as string)).length

    // Deterministically force a caution to deploy at end-of-lap N: saturate crash
    // hazard and make every crash a heavy shunt (-> 'major' trigger -> guaranteed
    // deploy from green). Aggressive, low-discipline drivers so the flag-offence
    // detector WOULD fire on lap N if the block (incorrectly) saw the new caution.
    const FORCE_DEPLOY: RaceIncidentConfig = {
      ...DEFAULT_RACE_INCIDENT_CONFIG, crashBaseHazard: 0.9, mechanicalBaseHazard: 0, crashCautionShare: 1, crashMajorShare: 1,
    }
    const greenAggressive = (): SimRaceState => {
      const s = mockRaceState()
      s.safetyCar = 'green'
      s.cautionLapsRemaining = 0
      for (const st of s.strategies) st.currentCommand = 'overtake'
      for (const d of s.drivers) { d.attributes.experience = 25; d.attributes.mentality = 25 }
      return s
    }

    // Lap N: the incident roll is DETERMINISTIC here — the incident PRNG derives
    // from the fixed state.raceSeed + currentLap (via mixSeed), NOT the per-iteration
    // createPRNG(seed) — so FORCE_DEPLOY deploys the SAME caution on every iteration
    // (deployCount === 200). The per-iteration seed varies the MAIN-LOOP rng that
    // drives the flag-state-offence detector. Because the flag is green at lap start,
    // that block is skipped, so ZERO flag offences may fire on the deploy lap across
    // all 200 detector seeds. THIS toBe(0) is the real guard: a regression moving
    // advanceRaceFlags ahead of the flag-offence block would expose the freshly-
    // deployed SC on lap N, and at least one of these 200 seeds would fire an offence.
    let deployCount = 0
    for (let seed = 1; seed <= 200; seed++) {
      const s = greenAggressive()
      const r = simulateLap(s, createPRNG(seed), FORCE_DEPLOY)
      if (s.safetyCar === 'green') continue // never taken: the deploy is deterministic
      deployCount++
      expect(flagOffenceCount(r.incidents), `seed ${seed}: no flag offence may fire on the deploy lap (N->N+1)`).toBe(0)
    }
    expect(deployCount, 'sanity: the forced caution deploys on lap N every iteration (keeps the toBe(0) gate non-vacuous)').toBe(200)

    // Lap N+1: under the now-active caution the flag-offence block runs. Mirror
    // the post-deploy condition (caution active, next lap, no fresh incidents) and
    // confirm enforcement is LIVE -> a flag offence can now fire.
    const onCautionNextLap = (): SimRaceState => {
      const s = greenAggressive()
      s.safetyCar = 'sc'          // the caution that deployed at end-of-lap N
      s.cautionLapsRemaining = 5  // survives the end-of-(N+1) FSM decrement
      s.currentLap = 11           // N+1
      return s
    }
    const ZERO_CRASH: RaceIncidentConfig = { ...DEFAULT_RACE_INCIDENT_CONFIG, crashBaseHazard: 0, mechanicalBaseHazard: 0 }
    let enforcedOnNext = false
    for (let seed = 1; seed <= 500; seed++) {
      const s = onCautionNextLap()
      const r = simulateLap(s, createPRNG(seed), ZERO_CRASH)
      if (flagOffenceCount(r.incidents) > 0) { enforcedOnNext = true; break }
    }
    expect(enforcedOnNext, 'flag-state offences must be enforceable on lap N+1 (under the active caution)').toBe(true)
  })
})

describe('retired (RET) rows — LapResult.retired pipeline', () => {
  it('emits a frozen RET row (retired:true, lapTime:0) for an already-retired driver, positioned after the running cars', () => {
    // d3 retired on a prior lap. simulateLap must append a self-contained RET
    // row so each lapUpdate carries the full grid for the UI's single flag.
    const state = mockRaceState()
    state.dnfDriverIds = { d3: true }
    const { lapResults } = simulateLap(state, createPRNG(7))

    const running = lapResults.filter((r) => !r.retired)
    const retired = lapResults.filter((r) => r.retired)
    // Running cars are the 3 non-DNF drivers; d3 is the single RET row.
    expect(running.map((r) => r.driverId).sort()).toEqual(['d1', 'd2', 'd4'])
    expect(retired).toHaveLength(1)
    const ret = retired[0]
    expect(ret.driverId).toBe('d3')
    expect(ret.lapTime).toBe(0)
    expect(ret.retired).toBe(true)
    // The RET row sits behind every running car.
    const maxRunning = Math.max(...running.map((r) => r.position))
    expect(ret.position).toBeGreaterThan(maxRunning)
    // Running rows are never flagged retired.
    expect(running.every((r) => r.lapTime > 0)).toBe(true)
  })

  it('a failure-to-serve DNF appears as a retired row (no crash/mechanical incident involved) — bug #1 proof', () => {
    // Mark a driver DNF directly (the failure-to-serve path sets dnfDriverIds
    // without emitting a crash/mechanical incident). It must still surface as a
    // RET row purely from the dnfDriverIds-driven append.
    const ZERO_HAZARD: RaceIncidentConfig = {
      ...DEFAULT_RACE_INCIDENT_CONFIG, crashBaseHazard: 0, mechanicalBaseHazard: 0,
    }
    const state = mockRaceState()
    state.dnfDriverIds = { d2: true }
    const { lapResults, incidents } = simulateLap(state, createPRNG(11), ZERO_HAZARD)

    // No crash/mechanical incident fired (failure-to-serve emits none).
    expect(incidents.some((i) => i.type === 'crash' || i.type === 'mechanical')).toBe(false)
    // d2 is nonetheless present as a retired row.
    const d2Rows = lapResults.filter((r) => r.driverId === 'd2')
    expect(d2Rows).toHaveLength(1)
    expect(d2Rows[0].retired).toBe(true)
    expect(d2Rows[0].lapTime).toBe(0)
  })

  it('a driver who crashes THIS lap keeps a real running row flipped to retired:true, then a RET row next lap', () => {
    // Force a guaranteed crash this lap (saturate hazard, all-crash). The crash
    // is marked at end-of-lap AFTER the push, so the driver still has a real
    // running row — which the retired-row pass flips to retired:true.
    const FORCE_CRASH: RaceIncidentConfig = {
      ...DEFAULT_RACE_INCIDENT_CONFIG, crashBaseHazard: 1, mechanicalBaseHazard: 0, crashCautionShare: 0, crashMajorShare: 0,
    }
    const state = mockRaceState()
    const { lapResults, incidents } = simulateLap(state, createPRNG(3), FORCE_CRASH)

    const crash = incidents.find((i) => i.type === 'crash')
    expect(crash, 'expected a forced crash this lap').toBeTruthy()
    const victim = crash!.driverIds[0]
    const thisLapRow = lapResults.find((r) => r.driverId === victim)!
    // This lap: the driver kept their real running row but it is now flagged retired.
    expect(thisLapRow.retired).toBe(true)
    // It is the real running row (real lap time), not the synthesized RET row.
    expect(thisLapRow.lapTime).toBeGreaterThan(0)
    // Exactly one row for the victim this lap (no duplicate RET append).
    expect(lapResults.filter((r) => r.driverId === victim)).toHaveLength(1)

    // Next lap: the driver is in dnfDriverIds, so they get a frozen RET row.
    const next = simulateLap(state, createPRNG(3), FORCE_CRASH)
    const nextRows = next.lapResults.filter((r) => r.driverId === victim)
    expect(nextRows).toHaveLength(1)
    expect(nextRows[0].retired).toBe(true)
    expect(nextRows[0].lapTime).toBe(0)
  })

  it('full-race lapData (RET rows included) is byte-identical across two seeded runs with incidents', () => {
    // Determinism gate extended to cover RET rows: they are PRNG-free, so two
    // seeded runs that produce retirements must yield identical lapData.
    const riskySetup: RaceSetup = {
      drivers: [
        { id: 'd1', shortName: 'D1', teamId: 't1', car: { downforce: 70, straightSpeed: 70, reliability: 30, tireManagement: 70, braking: 70, cornering: 70 }, attributes: { pace: 70, racecraft: 25, experience: 25, mentality: 60, marketability: 60, developmentPotential: 60 }, mood: { motivation: 50, frustration: 90, confidence: 50 } },
        { id: 'd2', shortName: 'D2', teamId: 't2', car: { downforce: 70, straightSpeed: 70, reliability: 30, tireManagement: 70, braking: 70, cornering: 70 }, attributes: { pace: 70, racecraft: 25, experience: 25, mentality: 60, marketability: 60, developmentPotential: 60 }, mood: { motivation: 50, frustration: 90, confidence: 50 } },
      ],
      circuit: { id: 'monza', name: 'Monza', laps: 60, tireWear: 'medium', overtakingDifficulty: 'medium', weatherVariability: 'low', compounds: ['C2', 'C3', 'C4'] },
      strategies: [
        { driverId: 'd1', plannedStops: [], currentCommand: 'standard' },
        { driverId: 'd2', plannedStops: [], currentCommand: 'standard' },
      ],
      weather: 'dry',
      gridOrder: ['d1', 'd2'],
    }
    // Find a seed that produces at least one RET row, then assert two-run equality.
    let firedSeed = -1
    let firedRun: ReturnType<typeof simulateRace> | null = null
    for (let s = 1; s <= 1000; s++) {
      const r = simulateRace(riskySetup, s)
      if (r.lapData.some((lap) => lap.some((lr) => lr.retired))) { firedSeed = s; firedRun = r; break }
    }
    expect(firedSeed, 'expected a seed in 1..1000 to produce a RET row').toBeGreaterThan(0)
    const rerun = simulateRace(riskySetup, firedSeed)
    expect(rerun.lapData).toEqual(firedRun!.lapData)
  })

  it('fastest lap is unaffected by RET rows (lapTime 0 never wins; value stays >0)', () => {
    // A race with retirements still reports a real (>0) fastest lap from a
    // running car — the 0-time RET rows are excluded by the >0 guard.
    const riskySetup: RaceSetup = {
      drivers: [
        { id: 'd1', shortName: 'D1', teamId: 't1', car: { downforce: 70, straightSpeed: 70, reliability: 30, tireManagement: 70, braking: 70, cornering: 70 }, attributes: { pace: 70, racecraft: 25, experience: 25, mentality: 60, marketability: 60, developmentPotential: 60 }, mood: { motivation: 50, frustration: 90, confidence: 50 } },
        { id: 'd2', shortName: 'D2', teamId: 't2', car: { downforce: 70, straightSpeed: 70, reliability: 99, tireManagement: 70, braking: 70, cornering: 70 }, attributes: { pace: 70, racecraft: 95, experience: 95, mentality: 90, marketability: 60, developmentPotential: 60 }, mood: { motivation: 50, frustration: 5, confidence: 90 } },
      ],
      circuit: { id: 'monza', name: 'Monza', laps: 60, tireWear: 'medium', overtakingDifficulty: 'medium', weatherVariability: 'low', compounds: ['C2', 'C3', 'C4'] },
      strategies: [
        { driverId: 'd1', plannedStops: [], currentCommand: 'standard' },
        { driverId: 'd2', plannedStops: [], currentCommand: 'standard' },
      ],
      weather: 'dry',
      gridOrder: ['d1', 'd2'],
    }
    for (let s = 1; s <= 1000; s++) {
      const r = simulateRace(riskySetup, s)
      const hasRet = r.lapData.some((lap) => lap.some((lr) => lr.retired))
      if (!hasRet) continue
      // A real fastest lap was recorded, with a strictly positive lap time and a
      // non-empty driver id (never the 0-time RET row).
      expect(r.fastestLap.time).toBeGreaterThan(0)
      expect(r.fastestLap.time).toBeLessThan(Infinity)
      expect(r.fastestLap.driverId).not.toBe('')
      return
    }
    throw new Error('expected a seed in 1..1000 to produce a RET row')
  })
})

// ---------------------------------------------------------------------------
// Race-end fold: pendingTimePenalties applied after the final lap
// ---------------------------------------------------------------------------

/**
 * Build a 2-driver RaceSetup where:
 * - D1 starts P1, D2 starts P2.
 * - D2 has a small but consistent pace advantage (~2s/lap via 'overtake' command).
 * - D2 has very low racecraft/experience so every contested event results in
 *   a fault investigation.
 * - No pit stops for either driver, so any pending penalty cannot be served
 *   during the race and MUST be applied at the race-end fold.
 * - The race is 6 laps: over 6 laps D2 builds ~14s gap via pace advantage.
 *   The penalty for a drive-through (collision-serious) is 20s, which EXCEEDS
 *   the gap. So with the fold applied, D1 finishes P1.
 * - Verified via seed-scan: seed=1 always produces a 20s penalty for D2
 *   (collision-serious / drive-through), leaving D2 with a final gap of
 *   ~14s BEFORE fold → D2 is P1. After fold (+20s to D2's cumulative) → D1 is P1.
 */
function makeRaceEndFoldSetup(): RaceSetup {
  return {
    drivers: [
      {
        id: 'd1',
        shortName: 'D1',
        teamId: 't1',
        car: { downforce: 80, straightSpeed: 80, reliability: 99, tireManagement: 80, braking: 80, cornering: 80 },
        attributes: { pace: 80, racecraft: 80, experience: 80, mentality: 80, marketability: 70, developmentPotential: 60 },
        mood: { motivation: 50, frustration: 30, confidence: 60 },
      },
      {
        id: 'd2',
        shortName: 'D2',
        teamId: 't2',
        // Same car as d1 but higher pace attribute — only ~2s/lap faster, not 10s.
        // Over 6 laps that is ~14s gap. Any ≥15s penalty flips positions.
        car: { downforce: 80, straightSpeed: 80, reliability: 99, tireManagement: 80, braking: 80, cornering: 80 },
        // Extremely reckless: fault probability ~1.0 on every contested event.
        attributes: { pace: 82, racecraft: 5, experience: 5, mentality: 80, marketability: 70, developmentPotential: 60 },
        mood: { motivation: 50, frustration: 30, confidence: 60 },
      },
    ],
    circuit: {
      id: 'test-fold',
      name: 'Test Fold',
      laps: 6,
      tireWear: 'low',
      overtakingDifficulty: 'high',
      weatherVariability: 'low',
      compounds: ['C2', 'C3', 'C4'],
    },
    strategies: [
      { driverId: 'd1', plannedStops: [], currentCommand: 'standard' },
      // d2 always attacks — no planned stops so it can never serve a penalty at pit.
      { driverId: 'd2', plannedStops: [], currentCommand: 'overtake' },
    ],
    weather: 'dry',
    gridOrder: ['d1', 'd2'],
    calibration: {
      ...createFallbackProfile('test-fold'),
      overtake: { overtakeModifier: 1.0, drsEffectiveness: 0.5 },
    },
  }
}

describe('simulateRace — race-end pendingTimePenalties fold', () => {
  it('determinism replay: the same seed produces byte-identical results across two runs', () => {
    // This is the strongest determinism test: full RaceResult deep-equality.
    // The fold must not introduce any non-determinism.
    const setup = makeRaceEndFoldSetup()
    const SEED = 777
    const result1 = simulateRace(setup, SEED)
    const result2 = simulateRace(setup, SEED)

    expect(result1.finalPositions).toEqual(result2.finalPositions)
    expect(result1.incidents).toEqual(result2.incidents)
    expect(result1.commentary).toEqual(result2.commentary)
    expect(result1.fastestLap).toEqual(result2.fastestLap)
    // Compare all lap data for complete byte-equality
    expect(result1.lapData).toEqual(result2.lapData)
    // Tier C IP-C1: explicit safety-car incident determinism gate
    const sc1 = result1.incidents.filter((i) => i.type === 'safety-car')
    const sc2 = result2.incidents.filter((i) => i.type === 'safety-car')
    expect(sc1).toEqual(sc2)
  })

  it('Tier C IP-C2: track-limits penalties are deterministic across two seeded runs', () => {
    // The fold determinism setup uses circuit id 'test-fold' which has NO corner
    // profile (no monitored corners → no track-limits events), so that assertion
    // would be vacuous. Use a real circuit ('spielberg' — tier-3 hotspots) with
    // reckless low-experience / high-frustration drivers over a long race so the
    // end-of-lap track-limits FSM reproducibly issues 5s time penalties. The
    // deterministic `tl-<lap>-<driverId>` investigationId makes the stream stable.
    const recklessSetup: RaceSetup = {
      drivers: [
        {
          id: 'd1', shortName: 'D1', teamId: 't1',
          car: { downforce: 80, straightSpeed: 80, reliability: 99, tireManagement: 80, braking: 80, cornering: 80 },
          attributes: { pace: 80, racecraft: 80, experience: 20, mentality: 80, marketability: 70, developmentPotential: 60 },
          mood: { motivation: 50, frustration: 95, confidence: 60 },
        },
        {
          id: 'd2', shortName: 'D2', teamId: 't2',
          car: { downforce: 80, straightSpeed: 80, reliability: 99, tireManagement: 80, braking: 80, cornering: 80 },
          attributes: { pace: 80, racecraft: 80, experience: 25, mentality: 80, marketability: 70, developmentPotential: 60 },
          mood: { motivation: 50, frustration: 90, confidence: 60 },
        },
      ],
      circuit: {
        id: 'spielberg', // real circuit with tier-3 trackLimitMonitored corners
        name: 'Austrian Grand Prix',
        laps: 60,
        tireWear: 'low',
        overtakingDifficulty: 'low',
        weatherVariability: 'low',
        compounds: ['C3', 'C4', 'C5'],
      },
      strategies: [
        { driverId: 'd1', plannedStops: [], currentCommand: 'standard' },
        { driverId: 'd2', plannedStops: [], currentCommand: 'standard' },
      ],
      weather: 'dry',
      gridOrder: ['d1', 'd2'],
      calibration: {
        ...createFallbackProfile('spielberg'),
        overtake: { overtakeModifier: 1.0, drsEffectiveness: 0.5 },
      },
    }

    // Seed 2 reproducibly issues 4 track-limits time penalties for this setup
    // (verified via a seed scan), so the FSM is genuinely exercised.
    const SEED = 2
    const tlIncidents = (r: ReturnType<typeof simulateRace>) =>
      r.incidents.filter((i) => i.type === 'penalty-issued' && i.offenceType === 'track-limits')

    const run1 = simulateRace(recklessSetup, SEED)
    const run2 = simulateRace(recklessSetup, SEED)
    const tl1 = tlIncidents(run1)
    const tl2 = tlIncidents(run2)

    // The setup must actually exercise the FSM, otherwise the gate is vacuous.
    expect(tl1.length).toBeGreaterThan(0)
    // Byte-identical track-limits penalty stream across two seeded runs.
    expect(tl1).toEqual(tl2)
  })

  it('Tier C IP-C3: rejoin-collision opens an investigation at a high-rejoinRisk monitored corner', () => {
    // Use silverstone: Copse (high rejoinRisk, monitored) and Maggotts (high rejoinRisk,
    // monitored) both provide the escalation path. Drivers have low racecraft (25) and
    // high frustration (95) + low experience (20) to maximise track-limits breach
    // rate (gating condition) and then maximise the rejoin-collision roll probability.
    // A seed scan across 1..100 finds the first seed that produces at least one
    // investigation-opened incident with offenceType 'rejoin-collision'.
    const recklessSetup: RaceSetup = {
      drivers: [
        {
          id: 'd1', shortName: 'D1', teamId: 't1',
          car: { downforce: 80, straightSpeed: 80, reliability: 99, tireManagement: 80, braking: 80, cornering: 80 },
          attributes: { pace: 80, racecraft: 25, experience: 20, mentality: 80, marketability: 70, developmentPotential: 60 },
          mood: { motivation: 50, frustration: 95, confidence: 60 },
        },
        {
          id: 'd2', shortName: 'D2', teamId: 't2',
          car: { downforce: 80, straightSpeed: 80, reliability: 99, tireManagement: 80, braking: 80, cornering: 80 },
          attributes: { pace: 80, racecraft: 25, experience: 20, mentality: 80, marketability: 70, developmentPotential: 60 },
          mood: { motivation: 50, frustration: 95, confidence: 60 },
        },
      ],
      circuit: {
        id: 'silverstone', // Copse + Maggotts: high rejoinRisk, trackLimitMonitored
        name: 'British Grand Prix',
        laps: 52,
        tireWear: 'low',
        overtakingDifficulty: 'low',
        weatherVariability: 'low',
        compounds: ['C3', 'C4', 'C5'],
      },
      strategies: [
        { driverId: 'd1', plannedStops: [], currentCommand: 'standard' },
        { driverId: 'd2', plannedStops: [], currentCommand: 'standard' },
      ],
      weather: 'dry',
      gridOrder: ['d1', 'd2'],
      calibration: {
        ...createFallbackProfile('silverstone'),
        overtake: { overtakeModifier: 0.3, drsEffectiveness: 0.3 },
      },
    }

    // Helper: filter incidents to those that are investigation-opened rejoin-collisions.
    const rejoinInvestigations = (r: ReturnType<typeof simulateRace>) =>
      r.incidents.filter(
        (i): i is Extract<typeof i, { type: 'investigation-opened' }> =>
          i.type === 'investigation-opened',
      ).filter(i => i.offenceType === 'rejoin-collision')

    // Seed scan: find the lowest seed in 1..200 that fires a rejoin-collision investigation.
    let firedSeed = -1
    let firedResult: ReturnType<typeof simulateRace> | null = null
    for (let s = 1; s <= 200; s++) {
      const r = simulateRace(recklessSetup, s)
      if (rejoinInvestigations(r).length > 0) {
        firedSeed = s
        firedResult = r
        break
      }
    }

    // The scan must find a firing seed — if it doesn't the wiring is broken.
    expect(firedSeed, 'expected a seed in 1..200 to fire a rejoin-collision investigation').toBeGreaterThan(0)
    expect(firedResult).not.toBeNull()

    const invs = rejoinInvestigations(firedResult!)
    expect(invs.length).toBeGreaterThan(0)
    expect(invs[0].offenceType).toBe('rejoin-collision')

    // Determinism: the same seed must produce byte-identical results.
    const run2 = simulateRace(recklessSetup, firedSeed)
    const invs2 = rejoinInvestigations(run2)
    expect(invs2).toEqual(invs)
  })

  it('Tier C IP-C4: flag offences NEVER fire under green flag (green-flag-never gate)', () => {
    // PURPOSE: prove the flag-state breach loop is GATED on safetyCar !== 'green'.
    // Drivers use 'standard' (not 'overtake') to prevent contested-overtake serious
    // incidents from deploying a caution mid-lap — keeping the flag cleanly green
    // for all 200 seeds and ensuring any future failure is a genuine gate regression,
    // not a caution accidentally deployed by the overtake path.
    // Low experience/mentality means the detector would fire readily IF the gate opened.
    const FLAG_OFFENCE_TYPES = new Set([
      'yellow-flag-breach', 'sc-infraction', 'vsc-infraction', 'red-flag-breach',
    ])

    // Use `mockRaceState()` with safetyCar forced to 'green'. This is the pure
    // simulateLap approach — the FSM decrement runs but since cautionLapsRemaining
    // is 0 and safetyCar is 'green' and no triggerCaution fires, the flag stays
    // green across all 200 seeds. The flag-state breach loop is gated on
    // state.safetyCar !== 'green', so it is entirely skipped every lap.
    const state = mockRaceState()
    state.safetyCar = 'green'
    state.cautionLapsRemaining = 0
    state.strategies[0].currentCommand = 'standard'
    state.strategies[1].currentCommand = 'standard'
    state.strategies[2].currentCommand = 'standard'
    state.strategies[3].currentCommand = 'standard'
    // Low experience + mentality — maximise detector fire probability IF it runs.
    for (const d of state.drivers) {
      d.attributes.experience = 25
      d.attributes.mentality = 25
    }

    let totalFlagOffenceIncidents = 0
    for (let seed = 1; seed <= 200; seed++) {
      const rng = createPRNG(seed)
      const result = simulateLap(state, rng)
      for (const inc of result.incidents) {
        if ('offenceType' in inc && inc.offenceType && FLAG_OFFENCE_TYPES.has(inc.offenceType as string)) {
          totalFlagOffenceIncidents++
        }
      }
    }

    expect(totalFlagOffenceIncidents, 'no flag-state offence incidents should fire under safetyCar: green').toBe(0)
  })

  it('Tier C IP-C4: sc-infraction investigation opens when a caution is active (under-caution gate)', () => {
    // Force a PERSISTING SC caution by setting safetyCar: 'sc' + cautionLapsRemaining: 5
    // (high enough to survive the advanceRaceFlags decrement on each simulateLap call).
    // All drivers use 'overtake' command and have low experience/mentality (25/25),
    // maximising detector breach probability. Seed-search across 1..500 until an
    // 'investigation-opened' incident with offenceType === 'sc-infraction' appears.
    // Then assert determinism: same state + seed → byte-identical sc-infraction incidents.

    const buildCautionState = (): SimRaceState => {
      const s = mockRaceState()
      s.safetyCar = 'sc'
      s.cautionLapsRemaining = 5   // survives the FSM decrement (5 − 1 = 4 → still 'sc')
      s.strategies[0].currentCommand = 'overtake'
      s.strategies[1].currentCommand = 'overtake'
      s.strategies[2].currentCommand = 'overtake'
      s.strategies[3].currentCommand = 'overtake'
      for (const d of s.drivers) {
        d.attributes.experience = 25
        d.attributes.mentality = 25
      }
      return s
    }

    type InvestigationOpenedIncident = Extract<ReturnType<typeof simulateLap>['incidents'][number], { type: 'investigation-opened' }>
    const scInvestigations = (incidents: ReturnType<typeof simulateLap>['incidents']): InvestigationOpenedIncident[] =>
      incidents.filter(
        (i): i is InvestigationOpenedIncident =>
          i.type === 'investigation-opened' && 'offenceType' in i && i.offenceType === 'sc-infraction',
      )

    // Seed scan: find the first seed in 1..500 that fires an sc-infraction investigation.
    let firedSeed = -1
    let firedIncidents: ReturnType<typeof simulateLap>['incidents'] = []
    for (let s = 1; s <= 500; s++) {
      const state = buildCautionState()
      const rng = createPRNG(s)
      const result = simulateLap(state, rng)
      if (scInvestigations(result.incidents).length > 0) {
        firedSeed = s
        firedIncidents = result.incidents
        break
      }
    }

    expect(firedSeed, 'expected a seed in 1..500 to fire an sc-infraction investigation').toBeGreaterThan(0)
    const invs = scInvestigations(firedIncidents)
    expect(invs.length).toBeGreaterThan(0)
    expect(invs[0].offenceType).toBe('sc-infraction')

    // Determinism sub-assertion: same seed + same initial state → identical sc-infraction stream.
    const state2 = buildCautionState()
    const rng2 = createPRNG(firedSeed)
    const result2 = simulateLap(state2, rng2)
    const invs2 = scInvestigations(result2.incidents)
    expect(invs2, 'sc-infraction incidents must be byte-identical across two runs with the same seed').toEqual(invs)
  })

  it('race-end fold: final-lap LapResult positions are consistent with finalPositions', () => {
    // The fold rewrites the final-lap LapResult.position values to match the
    // post-penalty cumulativeTimes ordering. This test verifies the invariant:
    // the position slot for each driver in the last lap of lapData must be
    // identical to their slot in finalPositions.
    //
    // Without the fold, this invariant is VIOLATED when a pending penalty exists:
    //   - simulateLap on the final lap sets positions BEFORE penalty is applied
    //   - simulateRace sets finalPositions = [...state.positions] also BEFORE fold
    //   - so both agree but EXCLUDE the penalty (neither is rewritten)
    // With the fold, BOTH are rewritten to include the penalty, preserving the
    // invariant correctly.
    //
    // This test uses seed=1 which deterministically produces a 20s d2 penalty
    // with a gap of ~14s → without fold both agree on wrong P1=d2, with fold
    // both agree on correct P1=d1. The key assertion is the SYNC invariant;
    // the position-flip test below tests the correctness direction.
    const setup = makeRaceEndFoldSetup()
    const SEED = 1

    const result = simulateRace(setup, SEED)

    const finalLap = result.lapData[result.lapData.length - 1]
    const finalLapByPos: string[] = new Array(result.finalPositions.length)
    for (const lr of finalLap) {
      finalLapByPos[lr.position - 1] = lr.driverId
    }

    // Both finalPositions and the final-lap LapResult positions must agree.
    expect(finalLapByPos).toEqual(result.finalPositions)
  })

  it('race-end fold: d2 drops from P1 to P2 when a 20s pending penalty exceeds their ~14s gap advantage', () => {
    // Verified setup (seed=1, 6 laps):
    //   - D2 builds ~14s cumulative gap over D1 via 'overtake' command pace boost.
    //   - D2 incurs a 20s drive-through penalty on lap 4 (collision-serious).
    //   - No pits, so the penalty stays in pendingTimePenalties until race end.
    //   - WITHOUT fold: D2's cumulativeTimes does NOT include the +20s → D2 is P1.
    //   - WITH fold: +20s is added → D2's adjusted total exceeds D1's → D1 is P1.
    //
    // This test FAILS before the fold is implemented and PASSES after.
    const setup = makeRaceEndFoldSetup()
    const SEED = 1

    const result = simulateRace(setup, SEED)

    // Confirm d2 got a penalty-issued incident (validates setup is working)
    const d2PenaltyIssued = result.incidents.some(
      inc => inc.type === 'penalty-issued' && inc.driverIds.includes('d2'),
    )
    expect(d2PenaltyIssued).toBe(true)

    // With the fold: the 20s penalty (> 14s gap) must push d2 behind d1.
    // D1 should be P1, D2 should be P2.
    expect(result.finalPositions[0]).toBe('d1')
    expect(result.finalPositions[1]).toBe('d2')
  })
})

describe('race radio — volume and determinism', () => {
  it('produces ≥25 radio entries over a 50-lap seeded race', () => {
    const setup = mockRadioRaceSetup()
    setup.circuit = { ...setup.circuit, laps: 50 }
    const result = simulateRace(setup, 12345)
    const radioEntries = result.commentary.filter(c => c.severity === 'radio')
    // With 4 drivers x 2 planned stops + lights-out + final-lap + fastest-lap +
    // organic overtake/defense radio, this fixture reproducibly emits ~50
    // entries on seed 12345. The bounds protect both volume floor and
    // anti-flood ceiling.
    expect(radioEntries.length).toBeGreaterThanOrEqual(25)
    expect(radioEntries.length).toBeLessThanOrEqual(120)
  })

  it('produces identical radio output for identical seed', () => {
    const setupA = mockRadioRaceSetup()
    setupA.circuit = { ...setupA.circuit, laps: 50 }
    const setupB = mockRadioRaceSetup()
    setupB.circuit = { ...setupB.circuit, laps: 50 }
    const a = simulateRace(setupA, 12345)
    const b = simulateRace(setupB, 12345)
    const radioA = a.commentary.filter(c => c.severity === 'radio').map(c => c.text)
    const radioB = b.commentary.filter(c => c.severity === 'radio').map(c => c.text)
    expect(radioA).toEqual(radioB)
  })

  it('a pit stop produces engineer + driver pair on the same lap', () => {
    const setup = mockRadioRaceSetup()
    setup.circuit = { ...setup.circuit, laps: 50 }
    const pitLap = setup.strategies[0]?.plannedStops[0]?.lap ?? 20
    const result = simulateRace(setup, 99)
    const pitLapEntries = result.commentary.filter(
      c => c.lap === pitLap && c.severity === 'radio',
    )
    const speakers = pitLapEntries.map(e => e.speaker)
    expect(speakers).toContain('engineer')
    expect(speakers).toContain('driver')
  })
})

// ─── applyRaceEndFold (parity helper) ────────────────────────────────────────

describe('applyRaceEndFold', () => {
  function tireState(): TireState {
    return { compound: 'C3' as TireCompound, label: 'medium', wear: 50, lapsFitted: 5 }
  }

  function lapResult(driverId: string, position: number): LapResult {
    return {
      lap: 50,
      driverId,
      lapTime: 80,
      sector1: 26,
      sector2: 27,
      sector3: 27,
      position,
      gapToLeader: 0,
      gapToAhead: 0,
      tire: tireState(),
      pitted: false,
      retired: false,
    }
  }

  function makeMinimalState(overrides: {
    positions: string[]
    cumulativeTimes: Record<string, number>
    pendingTimePenalties: Record<string, number>
  }): SimRaceState {
    const drivers = mockDrivers()
    return {
      currentLap: 50,
      totalLaps: 50,
      weather: { current: 'dry', rainProbability: 0, changeInLaps: null },
      safetyCar: 'green',
      cautionLapsRemaining: 0,
      raceSeed: 1234,
      trackLimitStrikes: {},
      trackTemp: 35,
      results: [],
      incidents: [],
      commentary: [],
      drivers,
      circuit: { id: 'silverstone', tireWear: 'medium', overtakingDifficulty: 'medium', weatherVariability: 'low' },
      calibration: createFallbackProfile('test-circuit'),
      strategies: mockStrategies(drivers),
      tireStates: Object.fromEntries(drivers.map(d => [d.id, tireState()])),
      positions: overrides.positions,
      cumulativeTimes: overrides.cumulativeTimes,
      pendingInvestigations: [],
      pendingTimePenalties: overrides.pendingTimePenalties,
      appliedPenaltiesByDriver: {},
    sanctionDeadlines: {},
    dnfDriverIds: {},
    teamCrews: {},
      radioFlags: {
        tireComplainedThisStint: {},
        weatherTransitionAnnounced: false,
        fastestLapAnnouncedTime: Infinity,
        finalLapAnnouncedFor: {},
        lightsOutAnnounced: false,
      },
      playerTeamId: undefined,
      playerDriverIds: [],
      championshipRivalIds: [],
    }
  }

  it('folds pending penalties into cumulative times and clears them', () => {
    const state = makeMinimalState({
      positions: ['d1', 'd2', 'd3', 'd4'],
      cumulativeTimes: { d1: 5400, d2: 5402, d3: 5410, d4: 5415 },
      pendingTimePenalties: { d1: 10, d2: 0, d3: 5 },
    })

    applyRaceEndFold(state, undefined)

    expect(state.cumulativeTimes.d1).toBe(5410)
    expect(state.cumulativeTimes.d2).toBe(5402)
    expect(state.cumulativeTimes.d3).toBe(5415)
    expect(state.cumulativeTimes.d4).toBe(5415)
    // Penalties are zeroed out so a re-fold is idempotent
    expect(state.pendingTimePenalties.d1).toBe(0)
    expect(state.pendingTimePenalties.d3).toBe(0)
  })

  it('re-sorts positions by cumulative time after the fold', () => {
    const state = makeMinimalState({
      positions: ['d1', 'd2', 'd3', 'd4'],
      cumulativeTimes: { d1: 5400, d2: 5402, d3: 5410, d4: 5415 },
      // d1 takes a 10s penalty that drops them behind d2
      pendingTimePenalties: { d1: 10 },
    })

    applyRaceEndFold(state, undefined)

    // d1 was leader at 5400, +10 = 5410 — now tied with d3 but d3's index
    // came later, so the stable sort places d2 first, then d1, d3, d4.
    expect(state.positions[0]).toBe('d2')
    // d1 at 5410 vs d3 at 5410 — order is preserved as input order under
    // stable sort, so d1 (was at index 0) comes before d3 (was at index 2).
    expect(state.positions[1]).toBe('d1')
    expect(state.positions[2]).toBe('d3')
    expect(state.positions[3]).toBe('d4')
  })

  it('rewrites final-lap LapResult.position to match the post-penalty order', () => {
    const state = makeMinimalState({
      positions: ['d1', 'd2', 'd3', 'd4'],
      cumulativeTimes: { d1: 5400, d2: 5402, d3: 5410, d4: 5415 },
      pendingTimePenalties: { d1: 30 },
    })
    const finalLap: LapResult[] = [
      lapResult('d1', 1),
      lapResult('d2', 2),
      lapResult('d3', 3),
      lapResult('d4', 4),
    ]

    applyRaceEndFold(state, finalLap)

    // After +30s, d1 (5430) is last. New order: d2, d3, d4, d1.
    expect(state.positions).toEqual(['d2', 'd3', 'd4', 'd1'])
    const byId = Object.fromEntries(finalLap.map(r => [r.driverId, r.position]))
    expect(byId.d2).toBe(1)
    expect(byId.d3).toBe(2)
    expect(byId.d4).toBe(3)
    expect(byId.d1).toBe(4)
  })

  it('is a no-op for the position list when there are no pending penalties', () => {
    const state = makeMinimalState({
      positions: ['d1', 'd2', 'd3', 'd4'],
      cumulativeTimes: { d1: 5400, d2: 5402, d3: 5410, d4: 5415 },
      pendingTimePenalties: {},
    })

    applyRaceEndFold(state, undefined)

    expect(state.positions).toEqual(['d1', 'd2', 'd3', 'd4'])
    expect(state.cumulativeTimes).toEqual({ d1: 5400, d2: 5402, d3: 5410, d4: 5415 })
  })

  it('classifies DNFs behind all finishers, ordered by cumulative DESC, and renumbers the grid 1..N', () => {
    // d2 + d3 are DNFs. d3 retired LATER (more cumulative time) ⇒ classified
    // ahead of d2. Finishers d1, d4 keep the front rows by cumulative asc.
    const state = makeMinimalState({
      positions: ['d1', 'd2', 'd3', 'd4'],
      cumulativeTimes: { d1: 5400, d2: 1200, d3: 3500, d4: 5415 },
      pendingTimePenalties: {},
    })
    state.dnfDriverIds = { d2: true, d3: true }
    const finalLap: LapResult[] = [
      lapResult('d1', 1),
      lapResult('d4', 2),
      // RET rows for the DNF drivers (positions reassigned by the fold).
      { ...lapResult('d3', 3), lapTime: 0, retired: true },
      { ...lapResult('d2', 4), lapTime: 0, retired: true },
    ]

    applyRaceEndFold(state, finalLap)

    // Finishers first (d1 < d4 by cumulative), then DNFs by cumulative desc
    // (d3 at 3500 ahead of d2 at 1200).
    expect(state.positions).toEqual(['d1', 'd4', 'd3', 'd2'])
    const byId = Object.fromEntries(finalLap.map(r => [r.driverId, r.position]))
    expect(byId.d1).toBe(1)
    expect(byId.d4).toBe(2)
    expect(byId.d3).toBe(3)
    expect(byId.d2).toBe(4)
    // Grid is contiguous 1..N with no gaps/dupes.
    expect([...finalLap.map(r => r.position)].sort((a, b) => a - b)).toEqual([1, 2, 3, 4])
  })
})
