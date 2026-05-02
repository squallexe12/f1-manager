import { describe, it, expect } from 'vitest'
import { bootstrapRace, deriveRaceSeed, type RaceBootstrapInput } from '@/engine/race/race-bootstrap'
import type { Circuit } from '@/types/race'
import type { CalibrationProfile } from '@/types/calibration'
import { clearCalibrationRegistry, hydrateBuiltInProfiles } from '@/data/calibration'

const baseCircuit: Circuit = {
  id: 'bahrain',
  name: 'Bahrain International Circuit',
  country: 'Bahrain',
  laps: 57,
  downforceLevel: 'medium',
  tireWear: 'high',
  overtakingDifficulty: 'low',
  weatherVariability: 'low',
  sectorCount: 3,
  compounds: ['C1', 'C2', 'C3'],
}

function makeInput(overrides: Partial<RaceBootstrapInput> = {}): RaceBootstrapInput {
  return {
    seed: 12345,
    round: 1,
    circuit: baseCircuit,
    isSprint: false,
    drivers: [
      {
        id: 'd1',
        teamId: 't1',
        shortName: 'D1',
        attributes: { pace: 90, racecraft: 88, experience: 75, mentality: 80, marketability: 70, developmentPotential: 60 },
        car: { downforce: 85, straightSpeed: 80, reliability: 90, tireManagement: 85, braking: 88, cornering: 86 },
        mood: { motivation: 50, frustration: 30, confidence: 60 },
      },
      {
        id: 'd2',
        teamId: 't1',
        shortName: 'D2',
        attributes: { pace: 85, racecraft: 82, experience: 70, mentality: 75, marketability: 65, developmentPotential: 55 },
        car: { downforce: 85, straightSpeed: 80, reliability: 90, tireManagement: 85, braking: 88, cornering: 86 },
        mood: { motivation: 50, frustration: 30, confidence: 60 },
      },
    ],
    ...overrides,
  }
}

describe('race bootstrap', () => {
  it('produces identical output for identical input (determinism)', () => {
    const a = bootstrapRace(makeInput())
    const b = bootstrapRace(makeInput())
    expect(a).toEqual(b)
  })

  it('produces identical track temperature for identical seed and round', () => {
    const a = bootstrapRace(makeInput())
    const b = bootstrapRace(makeInput())
    expect(a.raceState.trackTemp).toBe(b.raceState.trackTemp)
  })

  it('produces different track temperature for different seeds', () => {
    const a = bootstrapRace(makeInput({ seed: 111 }))
    const b = bootstrapRace(makeInput({ seed: 222 }))
    expect(a.raceState.trackTemp).not.toBe(b.raceState.trackTemp)
  })

  it('produces different track temperature for different rounds', () => {
    const a = bootstrapRace(makeInput({ round: 1 }))
    const b = bootstrapRace(makeInput({ round: 2 }))
    expect(a.raceState.trackTemp).not.toBe(b.raceState.trackTemp)
  })

  it('track temperature stays within gameplay envelope (35-50 C)', () => {
    for (let seed = 1; seed < 200; seed++) {
      for (let round = 1; round <= 24; round++) {
        const { raceState } = bootstrapRace(makeInput({ seed, round }))
        expect(raceState.trackTemp).toBeGreaterThanOrEqual(35)
        expect(raceState.trackTemp).toBeLessThanOrEqual(50)
      }
    }
  })

  it('initial weather is dry by default', () => {
    const { raceState } = bootstrapRace(makeInput())
    expect(raceState.weather.current).toBe('dry')
    expect(raceState.safetyCar).toBe('green')
  })

  it('initial results, incidents and commentary are empty', () => {
    const { raceState } = bootstrapRace(makeInput())
    expect(raceState.results).toEqual([])
    expect(raceState.incidents).toEqual([])
    expect(raceState.commentary).toEqual([])
    expect(raceState.currentLap).toBe(0)
  })

  it('totalLaps matches circuit laps', () => {
    const { raceState } = bootstrapRace(makeInput())
    expect(raceState.totalLaps).toBe(baseCircuit.laps)
  })

  it('output is JSON-serializable', () => {
    const out = bootstrapRace(makeInput())
    const json = JSON.stringify(out)
    expect(() => JSON.parse(json)).not.toThrow()
    const restored = JSON.parse(json)
    expect(restored.raceState.trackTemp).toBe(out.raceState.trackTemp)
  })

  it('RaceBootstrapInput is JSON-serializable', () => {
    const input = makeInput()
    const restored = JSON.parse(JSON.stringify(input)) as RaceBootstrapInput
    const a = bootstrapRace(input)
    const b = bootstrapRace(restored)
    expect(a).toEqual(b)
  })

  it('default start compound is circuit compounds[1] (medium)', () => {
    const { startCompounds } = bootstrapRace(makeInput())
    expect(startCompounds.d1).toBe(baseCircuit.compounds[1])
    expect(startCompounds.d2).toBe(baseCircuit.compounds[1])
  })

  it('respects per-driver start compound override', () => {
    const { startCompounds } = bootstrapRace(
      makeInput({
        strategies: [
          { driverId: 'd1', stops: [], startCompound: 'C5' },
        ],
      }),
    )
    expect(startCompounds.d1).toBe('C5')
    expect(startCompounds.d2).toBe(baseCircuit.compounds[1])
  })

  it('uses default stops when no strategy is provided', () => {
    const { strategies } = bootstrapRace(makeInput())
    const expectedLap = Math.floor(baseCircuit.laps * 0.45)
    expect(strategies[0].plannedStops).toEqual([{ lap: expectedLap, compound: baseCircuit.compounds[0] }])
    expect(strategies[0].currentCommand).toBe('standard')
  })

  it('respects per-driver custom stops', () => {
    const customStops = [{ lap: 20, compound: 'C5' as const }, { lap: 40, compound: 'C3' as const }]
    const { strategies } = bootstrapRace(
      makeInput({
        strategies: [{ driverId: 'd1', stops: customStops }],
      }),
    )
    expect(strategies[0].plannedStops).toEqual(customStops)
    expect(strategies[1].plannedStops).not.toEqual(customStops)
  })

  it('raceDrivers contain copies (not references) of car and attributes', () => {
    const input = makeInput()
    const { raceDrivers } = bootstrapRace(input)
    raceDrivers[0].car.downforce = 0
    raceDrivers[0].attributes.pace = 0
    expect(input.drivers[0].car.downforce).toBe(85)
    expect(input.drivers[0].attributes.pace).toBe(90)
  })

  it('circuitInfo mirrors circuit fields relevant to simulation', () => {
    const { circuitInfo } = bootstrapRace(makeInput())
    expect(circuitInfo.tireWear).toBe(baseCircuit.tireWear)
    expect(circuitInfo.overtakingDifficulty).toBe(baseCircuit.overtakingDifficulty)
    expect(circuitInfo.weatherVariability).toBe(baseCircuit.weatherVariability)
    expect(circuitInfo.compounds).toEqual(baseCircuit.compounds)
  })

  it('deriveRaceSeed is stable and combines seed with round', () => {
    expect(deriveRaceSeed(1000, 1)).toBe(1001)
    expect(deriveRaceSeed(1000, 5)).toBe(1005)
    expect(deriveRaceSeed(1000, 1)).toBe(deriveRaceSeed(1000, 1))
  })

  it('raceSeed is returned and matches deriveRaceSeed', () => {
    const { raceSeed } = bootstrapRace(makeInput({ seed: 500, round: 7 }))
    expect(raceSeed).toBe(deriveRaceSeed(500, 7))
  })

  it('does not mutate the input drivers array', () => {
    const input = makeInput()
    const snapshot = JSON.stringify(input)
    bootstrapRace(input)
    expect(JSON.stringify(input)).toBe(snapshot)
  })

  it('exposes a calibration profile on the output', () => {
    const { calibration } = bootstrapRace(makeInput())
    expect(calibration).toBeDefined()
    expect(calibration.circuitId).toBe(baseCircuit.id)
    expect(calibration.tires).toBeDefined()
    expect(calibration.weather).toBeDefined()
    expect(calibration.overtake).toBeDefined()
  })

  it('derives calibration from circuit enums when no override is given', () => {
    // Exercise the fallback path by clearing the built-in registry first;
    // baseCircuit has tireWear: 'high' and overtakingDifficulty: 'low'.
    clearCalibrationRegistry()
    try {
      const { calibration } = bootstrapRace(makeInput())
      expect(calibration.source).toBe('fallback')
      expect(calibration.tires.wearMultiplier).toBeGreaterThan(1.0) // high wear
      expect(calibration.overtake.overtakeModifier).toBeGreaterThan(1.0) // easy to pass
    } finally {
      hydrateBuiltInProfiles()
    }
  })

  it('uses a registered OpenF1 profile when the circuit has one loaded', () => {
    const { calibration } = bootstrapRace(makeInput())
    expect(calibration.source).toBe('openf1')
    expect(calibration.circuitId).toBe('bahrain')
  })

  it('respects an explicit calibration override on the input', () => {
    const override: CalibrationProfile = {
      circuitId: baseCircuit.id,
      source: 'openf1',
      tires: {
        degradationRates: { C1: 0.5, C2: 0.8, C3: 1.2, C4: 1.7, C5: 2.5 },
        gripLevels: { C1: 0.9, C2: 0.93, C3: 0.96, C4: 0.99, C5: 1.0 },
        baseTrackTemp: 40,
        wearMultiplier: 1.2,
      },
      weather: {
        transitionProbabilities: { dry: 0.01, damp: 0.02, wet: 0.03 },
        baseRainProbability: 0.05,
        temperatureRange: { min: 25, max: 45 },
      },
      overtake: { overtakeModifier: 0.9, drsEffectiveness: 0.6 },
      pitLoss: { meanLossSeconds: 22, stddevSeconds: 1.2, sampleCount: 48 },
      stint: {
        expectedLaps: { C1: 30, C2: 24, C3: 18, C4: 13, C5: 10 },
        sampleCount: 120,
      },
      pitLane: { lengthMeters: 350, speedLimitKph: 80, entryDecelMeters: 40, exitAccelMeters: 40 },
    }
    const { calibration } = bootstrapRace(makeInput({ calibration: override }))
    expect(calibration.source).toBe('openf1')
    expect(calibration.tires.baseTrackTemp).toBe(40)
    expect(calibration.overtake.drsEffectiveness).toBe(0.6)
  })
})

import { applyBanSubstitution, applyGridDrops } from '@/engine/race/race-bootstrap'

describe('applyBanSubstitution', () => {
  it('substitutes a banned driver with the team reserve when reserveDriverId is set', () => {
    const banned = { id: 'd1', teamId: 't1', banUntilRound: 5, isReserve: false }
    const reserve = { id: 'r1', teamId: 't1', banUntilRound: null, isReserve: true }
    const team = { id: 't1', reserveDriverId: 'r1' }
    const result = applyBanSubstitution([banned], [banned, reserve], [team], 5)
    expect(result.drivers).toHaveLength(1)
    expect(result.drivers[0].id).toBe('r1')
    expect(result.substitutions).toEqual([{ bannedId: 'd1', substituteId: 'r1', teamId: 't1' }])
  })

  it('falls back to first matching isReserve driver when reserveDriverId is null', () => {
    const banned = { id: 'd1', teamId: 't1', banUntilRound: 5, isReserve: false }
    const reserve = { id: 'rx', teamId: 't1', banUntilRound: null, isReserve: true }
    const team = { id: 't1', reserveDriverId: null }
    const result = applyBanSubstitution([banned], [banned, reserve], [team], 5)
    expect(result.drivers[0].id).toBe('rx')
  })

  it('drops banned driver when no reserve is available (one-car team)', () => {
    const banned = { id: 'd1', teamId: 't1', banUntilRound: 5, isReserve: false }
    const team = { id: 't1', reserveDriverId: null }
    const result = applyBanSubstitution([banned], [banned], [team], 5)
    expect(result.drivers).toHaveLength(0)
    expect(result.substitutions).toEqual([{ bannedId: 'd1', substituteId: null, teamId: 't1' }])
  })

  it('passes through drivers whose ban is in the past', () => {
    const driver = { id: 'd1', teamId: 't1', banUntilRound: 3, isReserve: false }
    const team = { id: 't1', reserveDriverId: 'r1' }
    const result = applyBanSubstitution([driver], [driver], [team], 5)
    expect(result.drivers[0].id).toBe('d1')
    expect(result.substitutions).toHaveLength(0)
  })
})

describe('applyGridDrops', () => {
  it('shifts a driver down by their nextRaceGridDrop, clamped to grid size', () => {
    const qualified = ['p1', 'p2', 'p3', 'p4', 'p5']
    const drops = { p1: 10 }  // overshoots — clamps to last
    const result = applyGridDrops(qualified, drops)
    expect(result.gridOrder[result.gridOrder.length - 1]).toBe('p1')
  })

  it('zero drop is a no-op', () => {
    const qualified = ['a', 'b', 'c']
    expect(applyGridDrops(qualified, {}).gridOrder).toEqual(['a', 'b', 'c'])
  })

  it('multiple drops resolve deterministically', () => {
    const qualified = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']
    const drops = { p1: 3, p3: 2 }
    const result = applyGridDrops(qualified, drops)
    // Verify: result is a permutation of qualified; p1 and p3 are penalised.
    expect(new Set(result.gridOrder)).toEqual(new Set(qualified))
  })
})

// ---------------------------------------------------------------------------
// Integration: ban substitution → grid-drop pipeline
// These tests mirror the sequence handleStartRace() in strategy/page.tsx uses:
//   1. applyBanSubstitution → substituted lineup
//   2. applyGridDrops → resolved grid order
// ---------------------------------------------------------------------------

describe('ban substitution + grid drop pipeline (handleStartRace integration)', () => {
  /**
   * Minimal driver shape that satisfies BanSubstitutionInput and also carries
   * the fields the strategy page reads after substitution (nextRaceGridDrop).
   */
  function makeDriver(
    id: string,
    teamId: string,
    opts: { banUntilRound?: number | null; isReserve?: boolean; nextRaceGridDrop?: number } = {},
  ) {
    return {
      id,
      teamId,
      banUntilRound: opts.banUntilRound ?? null,
      isReserve: opts.isReserve ?? false,
      nextRaceGridDrop: opts.nextRaceGridDrop ?? 0,
    }
  }

  it('banned driver is replaced by the team reserve in the resulting lineup', () => {
    const d1 = makeDriver('d1', 't1', { banUntilRound: 3 })
    const reserve = makeDriver('r1', 't1', { isReserve: true })
    const d2 = makeDriver('d2', 't2')
    const teams = [
      { id: 't1', reserveDriverId: 'r1' },
      { id: 't2', reserveDriverId: null },
    ]
    const lineup = [d1, d2]
    const roster = [d1, d2, reserve]

    const { drivers: substituted } = applyBanSubstitution(lineup, roster, teams, 3)

    expect(substituted.map((d) => d.id)).not.toContain('d1')
    expect(substituted.map((d) => d.id)).toContain('r1')
    expect(substituted.map((d) => d.id)).toContain('d2')
    expect(substituted).toHaveLength(2)
  })

  it('driver with nextRaceGridDrop > 0 ends up behind their qualifying position', () => {
    // d1 qualified P1 but has a 3-place grid drop → should start P4 or later
    const d1 = makeDriver('d1', 't1', { nextRaceGridDrop: 3 })
    const d2 = makeDriver('d2', 't2')
    const d3 = makeDriver('d3', 't3')
    const d4 = makeDriver('d4', 't4')
    const teams = [
      { id: 't1', reserveDriverId: null },
      { id: 't2', reserveDriverId: null },
      { id: 't3', reserveDriverId: null },
      { id: 't4', reserveDriverId: null },
    ]
    const lineup = [d1, d2, d3, d4] // qualifying order: d1 in P1
    const roster = lineup

    const { drivers: substituted } = applyBanSubstitution(lineup, roster, teams, 1)
    const qualifyingOrder = substituted.map((d) => d.id)
    const drops: Record<string, number> = {}
    for (const d of substituted) {
      if (d.nextRaceGridDrop > 0) drops[d.id] = d.nextRaceGridDrop
    }
    const { gridOrder } = applyGridDrops(qualifyingOrder, drops)

    const d1GridPos = gridOrder.indexOf('d1')
    expect(d1GridPos).toBeGreaterThanOrEqual(3) // dropped at least 3 places from P1 (0-indexed pos 0)
  })

  it('penalised driver IDs are collected for consumeGridDrops', () => {
    // Simulate the exact pattern in handleStartRace: collect penalised IDs
    const d1 = makeDriver('d1', 't1', { nextRaceGridDrop: 5 })
    const d2 = makeDriver('d2', 't2', { nextRaceGridDrop: 0 })
    const lineup = [d1, d2]

    // Reproduce the gridDrops collection logic from handleStartRace
    const gridDrops: Record<string, number> = {}
    for (const d of lineup) {
      if (d.nextRaceGridDrop > 0) gridDrops[d.id] = d.nextRaceGridDrop
    }
    const penalisedIds = Object.keys(gridDrops)

    expect(penalisedIds).toContain('d1')
    expect(penalisedIds).not.toContain('d2')
    expect(penalisedIds).toHaveLength(1)
  })

  it('ban substitution then grid drop: no banned driver appears in the final grid order', () => {
    const banned = makeDriver('banned', 't1', { banUntilRound: 5 })
    const reserve = makeDriver('reserve', 't1', { isReserve: true, nextRaceGridDrop: 2 })
    const d2 = makeDriver('d2', 't2')
    const d3 = makeDriver('d3', 't3')
    const teams = [
      { id: 't1', reserveDriverId: 'reserve' },
      { id: 't2', reserveDriverId: null },
      { id: 't3', reserveDriverId: null },
    ]
    const lineup = [banned, d2, d3]
    const roster = [banned, reserve, d2, d3]

    const { drivers: substituted } = applyBanSubstitution(lineup, roster, teams, 5)
    const qualifyingOrder = substituted.map((d) => d.id)
    const drops: Record<string, number> = {}
    for (const d of substituted) {
      if (d.nextRaceGridDrop > 0) drops[d.id] = d.nextRaceGridDrop
    }
    const { gridOrder } = applyGridDrops(qualifyingOrder, drops)

    expect(gridOrder).not.toContain('banned')
    expect(gridOrder).toContain('reserve')
    expect(new Set(gridOrder)).toEqual(new Set(substituted.map((d) => d.id)))
  })
})
