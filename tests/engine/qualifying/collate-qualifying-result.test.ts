import { describe, it, expect } from 'vitest'
import {
  collateQualifyingResult,
  simulateQualifying,
  simulateQualifyingSegment,
  SEGMENTS,
} from '@/engine/qualifying/quali-engine'
import { createPRNG } from '@/engine/core/prng'
import { deriveRaceSeed } from '@/engine/race/race-bootstrap'
import { deriveSessionSeed } from '@/engine/weekend/seed-derivation'
import type { BootstrapDriverInput, Circuit, TireCompound } from '@/types/race'
import type { QualiSegmentResult } from '@/types/weekend'

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
  f[5] = driver('d5', 100, 100)
  return f
}

/** Run the 3 standard segments live (per-segment streams, no player commands)
 *  and return just the segment results — the same inputs the M7 live store path
 *  accumulates before calling `collateQualifyingResult`. */
function liveSegments(raceSeed: number, round: number): QualiSegmentResult[] {
  const perRoundRoot = deriveRaceSeed(raceSeed, round)
  const drivers = field20()
  let entrants = drivers.map((d) => d.id)
  let ledger = { remaining: { C3: 3, C4: 4, C5: 30 } as Partial<Record<TireCompound, number>> }
  const out: QualiSegmentResult[] = []
  for (const def of SEGMENTS.qualifying) {
    const prng = createPRNG(deriveSessionSeed(perRoundRoot, def.segment))
    const { result, nextLedger } = simulateQualifyingSegment({
      segment: def.segment, entrants, advancingCount: Math.min(def.advancing, entrants.length),
      drivers, circuitCompounds: COMPOUNDS, weather: 'dry', setup: {},
      playerDriverIds: new Set(), playerCommands: new Map(), ledger, prng,
    })
    ledger = nextLedger
    out.push(result)
    entrants = result.advancing
  }
  return out
}

describe('collateQualifyingResult', () => {
  it('is byte-identical to simulateQualifying for the same seed (faithful extraction)', () => {
    const round = 5
    const raceSeed = 777
    const perRoundRoot = deriveRaceSeed(raceSeed, round)
    const segments = liveSegments(raceSeed, round)

    const collated = collateQualifyingResult({ format: 'qualifying', round, seed: perRoundRoot, segmentResults: segments })
    const headless = simulateQualifying({
      format: 'qualifying', round, raceSeed,
      drivers: field20(), circuit: circuit(), setup: {},
      ledger: { remaining: { C3: 3, C4: 4, C5: 30 } },
    }).result

    // The live-accumulated segments collate to exactly the headless classification.
    expect(JSON.stringify(collated)).toBe(JSON.stringify(headless))
  })

  it('maps Q3 -> P1-10, Q2-eliminated -> P11-15, Q1-eliminated -> P16-20', () => {
    const segments = liveSegments(777, 5)
    const r = collateQualifyingResult({ format: 'qualifying', round: 5, seed: 1, segmentResults: segments })
    expect(r.gridOrder).toHaveLength(20)
    expect(r.gridOrder.slice(0, 10)).toEqual(segments[2].results.map((x) => x.driverId))
    expect(r.gridOrder.slice(10, 15)).toEqual(segments[1].eliminated)
    expect(r.gridOrder.slice(15, 20)).toEqual(segments[0].eliminated)
  })

  it('captures pole (P1 + their final-segment time) and the session fastest lap', () => {
    const segments = liveSegments(777, 5)
    const r = collateQualifyingResult({ format: 'qualifying', round: 5, seed: 42, segmentResults: segments })
    expect(r.pole.driverId).toBe('d5')
    expect(r.pole.time).toBeGreaterThan(0)
    expect(r.fastestLap).not.toBeNull()
    expect(r.fastestLap!.driverId).toBe('d5')
    expect(r.seed).toBe(42) // passes the audit seed straight through
    expect(r.format).toBe('qualifying')
  })

  it('returns an empty (non-throwing) result for an empty segment list', () => {
    const r = collateQualifyingResult({ format: 'qualifying', round: 2, seed: 5, segmentResults: [] })
    expect(r.gridOrder).toEqual([])
    expect(r.segments).toEqual([])
    expect(r.pole).toEqual({ driverId: '', time: null })
    expect(r.fastestLap).toBeNull()
    expect(r.seed).toBe(5)
  })

  it('threads the format through and records null bestTimes for a no-time driver', () => {
    // One segment where 'b' aborts (no time) — bestTimes carries an explicit null.
    const { result } = simulateQualifyingSegment({
      segment: 'Q1', entrants: ['a', 'b'], advancingCount: 1,
      drivers: [driver('a', 90, 90), driver('b', 50, 50)],
      circuitCompounds: COMPOUNDS, weather: 'dry', setup: {},
      playerDriverIds: new Set(['b']),
      playerCommands: new Map([['b', { compound: 'C5' as TireCompound, aborted: true }]]),
      ledger: { remaining: { C5: 10 } }, prng: createPRNG(7),
    })
    const r = collateQualifyingResult({ format: 'sprint-qualifying', round: 3, seed: 9, segmentResults: [result] })
    expect(r.format).toBe('sprint-qualifying')
    expect(r.bestTimes.b).toBeNull()
    expect(r.bestTimes.a).toBeGreaterThan(0)
  })
})
