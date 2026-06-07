import { describe, it, expect } from 'vitest'
import { simulateQualifying, simulateQualifyingSegment, SEGMENTS } from '@/engine/qualifying/quali-engine'
import { createPRNG } from '@/engine/core/prng'
import { deriveRaceSeed } from '@/engine/race/race-bootstrap'
import { deriveSessionSeed } from '@/engine/weekend/seed-derivation'
import type { BootstrapDriverInput, Circuit, TireCompound } from '@/types/race'
import type { DriverWeekendSetup } from '@/types/weekend'

function driver(id: string, carRating: number, pace: number, experience = 60): BootstrapDriverInput {
  return {
    id, teamId: `t-${id}`, shortName: id.slice(0, 3).toUpperCase(),
    attributes: { pace, racecraft: 70, experience, mentality: 70, marketability: 50, developmentPotential: 50 },
    mood: { motivation: 70, frustration: 30, confidence: 70 },
    car: { downforce: carRating, straightSpeed: carRating, reliability: carRating, tireManagement: carRating, braking: carRating, cornering: carRating },
  }
}

function circuit(): Circuit {
  return {
    id: 'c', name: 'Test', country: 'X', laps: 50, downforceLevel: 'medium',
    tireWear: 'medium', overtakingDifficulty: 'medium', weatherVariability: 'medium',
    sectorCount: 3, compounds: ['C3', 'C4', 'C5'],
  }
}

const COMPOUNDS: readonly TireCompound[] = ['C3', 'C4', 'C5']

function field20(): BootstrapDriverInput[] {
  const f = Array.from({ length: 20 }, (_, i) => driver(`d${i}`, 50 + i, 50 + i))
  f[5] = driver('d5', 100, 100) // clearly fastest -> always P1 (gap >> noise)
  return f
}

function setupEntry(id: string, conf: number): DriverWeekendSetup {
  return { driverId: id, setupConfidence: conf, tireDegRead: 50, sessionsCompleted: 3 }
}

describe('SEGMENTS table', () => {
  it('standard = Q1/Q2/Q3 (15/10/10); sprint = SQ1/SQ2/SQ3', () => {
    expect(SEGMENTS.qualifying.map((s) => s.segment)).toEqual(['Q1', 'Q2', 'Q3'])
    expect(SEGMENTS.qualifying.map((s) => s.advancing)).toEqual([15, 10, 10])
    expect(SEGMENTS['sprint-qualifying'].map((s) => s.segment)).toEqual(['SQ1', 'SQ2', 'SQ3'])
  })
})

describe('simulateQualifying — determinism', () => {
  const base = () => ({
    format: 'qualifying' as const, round: 5, raceSeed: 12345,
    drivers: field20(), circuit: circuit(), setup: {},
    ledger: { remaining: { C3: 3, C4: 4, C5: 30 } },
  })

  it('is byte-identical across two runs with the same seed', () => {
    const a = simulateQualifying(base())
    const b = simulateQualifying(base())
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('different seeds produce different classifications', () => {
    const a = simulateQualifying({ ...base(), raceSeed: 1 })
    const b = simulateQualifying({ ...base(), raceSeed: 2 })
    expect(JSON.stringify(a.result.gridOrder)).not.toBe(JSON.stringify(b.result.gridOrder))
  })

  it('the classification is NOT roster order', () => {
    const f = field20()
    const { result } = simulateQualifying({ ...base(), drivers: f })
    expect(JSON.stringify(result.gridOrder)).not.toBe(JSON.stringify(f.map((d) => d.id)))
    expect(result.gridOrder[0]).toBe('d5') // the superstar earns pole
  })
})

describe('simulateQualifying — knockout structure & grid collation', () => {
  const out = () => simulateQualifying({
    format: 'qualifying', round: 5, raceSeed: 777,
    drivers: field20(), circuit: circuit(), setup: {},
    ledger: { remaining: { C3: 3, C4: 4, C5: 30 } },
  })

  it('segment sizes are 20/15/10 with eliminations 5/5/0', () => {
    const { result } = out()
    expect(result.segments[0].results).toHaveLength(20)
    expect(result.segments[0].advancing).toHaveLength(15)
    expect(result.segments[0].eliminated).toHaveLength(5)
    expect(result.segments[1].results).toHaveLength(15)
    expect(result.segments[1].advancing).toHaveLength(10)
    expect(result.segments[1].eliminated).toHaveLength(5)
    expect(result.segments[2].results).toHaveLength(10)
    expect(result.segments[2].eliminated).toHaveLength(0)
  })

  it('grid maps Q3 -> P1-10, Q2-eliminated -> P11-15, Q1-eliminated -> P16-20', () => {
    const { result } = out()
    expect(result.gridOrder).toHaveLength(20)
    expect(result.gridOrder.slice(0, 10)).toEqual(result.segments[2].results.map((r) => r.driverId))
    expect(result.gridOrder.slice(10, 15)).toEqual(result.segments[1].eliminated)
    expect(result.gridOrder.slice(15, 20)).toEqual(result.segments[0].eliminated)
  })

  it('captures pole (P1 + Q3 time) and a session fastest lap', () => {
    const { result } = out()
    expect(result.pole.driverId).toBe('d5')
    expect(result.pole.time).toBeGreaterThan(0)
    expect(result.fastestLap).not.toBeNull()
    expect(result.fastestLap!.driverId).toBe('d5')
  })

  it('every attempt carries lapDeleted=false in MVP', () => {
    const { result } = out()
    for (const seg of result.segments) {
      for (const r of seg.results) {
        for (const a of r.attempts) expect(a.lapDeleted).toBe(false)
      }
    }
  })
})

describe('simulateQualifying — sprint format', () => {
  it('threads the sprint-qualifying format through labels + result', () => {
    const { result } = simulateQualifying({
      format: 'sprint-qualifying', round: 4, raceSeed: 9,
      drivers: field20(), circuit: circuit(), setup: {},
      ledger: { remaining: { C3: 3, C4: 4, C5: 30 } },
    })
    expect(result.format).toBe('sprint-qualifying')
    expect(result.segments.map((s) => s.segment)).toEqual(['SQ1', 'SQ2', 'SQ3'])
  })
})

describe('simulateQualifyingSegment — segment mechanics', () => {
  const segSeed = () => createPRNG(deriveSessionSeed(deriveRaceSeed(123, 5), 'Q1'))

  it('higher setup confidence classifies ahead of an identical-car teammate', () => {
    const drivers = [driver('a', 70, 70), driver('b', 70, 70)]
    const { result } = simulateQualifyingSegment({
      segment: 'Q1', entrants: ['a', 'b'], advancingCount: 2, drivers,
      circuitCompounds: COMPOUNDS, weather: 'dry',
      setup: { a: setupEntry('a', 100), b: setupEntry('b', 0) },
      playerDriverIds: new Set(['a', 'b']), playerCommands: new Map(),
      ledger: { remaining: { C5: 10 } }, prng: segSeed(),
    })
    const a = result.results.find((r) => r.driverId === 'a')!
    const b = result.results.find((r) => r.driverId === 'b')!
    expect(a.bestLapTime!).toBeLessThan(b.bestLapTime!)
  })

  it('AI ignores setup confidence (clamped to neutral 50)', () => {
    const run = (conf: number) => simulateQualifyingSegment({
      segment: 'Q1', entrants: ['x'], advancingCount: 1, drivers: [driver('x', 70, 70)],
      circuitCompounds: COMPOUNDS, weather: 'dry', setup: { x: setupEntry('x', conf) },
      playerDriverIds: new Set(), playerCommands: new Map(),
      ledger: { remaining: { C5: 10 } }, prng: createPRNG(999),
    }).result.results[0].bestLapTime
    expect(run(100)).toBe(run(50)) // AI -> neutral regardless of the setup map
  })

  it('a player abort does NOT shift a later rival (phantom-draw invariant)', () => {
    const run = (xAborted: boolean) => simulateQualifyingSegment({
      segment: 'Q1', entrants: ['x', 'y'], advancingCount: 2,
      drivers: [driver('x', 70, 70), driver('y', 70, 70)],
      circuitCompounds: COMPOUNDS, weather: 'dry', setup: {},
      playerDriverIds: new Set(['x']),
      playerCommands: new Map([['x', { compound: 'C5' as TireCompound, aborted: xAborted }]]),
      ledger: { remaining: { C5: 10 } }, prng: createPRNG(555),
    }).result.results.find((r) => r.driverId === 'y')!.bestLapTime
    expect(run(true)).toBe(run(false))
  })

  it('an aborted player sets no time and is classified at the back', () => {
    const { result } = simulateQualifyingSegment({
      segment: 'Q1', entrants: ['x', 'y'], advancingCount: 1,
      drivers: [driver('x', 90, 90), driver('y', 50, 50)],
      circuitCompounds: COMPOUNDS, weather: 'dry', setup: {},
      playerDriverIds: new Set(['x']),
      playerCommands: new Map([['x', { compound: 'C5' as TireCompound, aborted: true }]]),
      ledger: { remaining: { C5: 10 } }, prng: createPRNG(7),
    })
    const x = result.results.find((r) => r.driverId === 'x')!
    expect(x.bestLapTime).toBeNull()
    expect(x.attempts[0].aborted).toBe(true)
    expect(result.results[result.results.length - 1].driverId).toBe('x') // null time -> back
  })

  it('decrements the ledger for a player run only (AI never)', () => {
    const { nextLedger } = simulateQualifyingSegment({
      segment: 'Q1', entrants: ['p', 'ai'], advancingCount: 2,
      drivers: [driver('p', 70, 70), driver('ai', 70, 70)],
      circuitCompounds: COMPOUNDS, weather: 'dry', setup: {},
      playerDriverIds: new Set(['p']),
      playerCommands: new Map([['p', { compound: 'C5' as TireCompound, aborted: false }]]),
      ledger: { remaining: { C5: 10 } }, prng: createPRNG(3),
    })
    expect(nextLedger.remaining.C5).toBe(9) // only the player consumed one set
  })

  it('wet weather adds ~8s vs dry for the same entrant/seed', () => {
    const mk = (weather: 'dry' | 'wet') => simulateQualifyingSegment({
      segment: 'Q1', entrants: ['x'], advancingCount: 1, drivers: [driver('x', 70, 70)],
      circuitCompounds: COMPOUNDS, weather, setup: {},
      playerDriverIds: new Set(), playerCommands: new Map(),
      ledger: { remaining: { C5: 10 } }, prng: createPRNG(88),
    }).result.results[0].bestLapTime!
    expect(mk('wet') - mk('dry')).toBeCloseTo(8, 6)
  })

  it('clamps advancingCount to the entrant count (short fields)', () => {
    const { result } = simulateQualifyingSegment({
      segment: 'Q1', entrants: ['a', 'b'], advancingCount: 15, drivers: [driver('a', 70, 70), driver('b', 60, 60)],
      circuitCompounds: COMPOUNDS, weather: 'dry', setup: {},
      playerDriverIds: new Set(), playerCommands: new Map(),
      ledger: { remaining: { C5: 10 } }, prng: createPRNG(1),
    })
    expect(result.advancing).toHaveLength(2)
    expect(result.eliminated).toHaveLength(0)
  })
})
