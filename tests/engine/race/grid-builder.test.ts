import { describe, it, expect } from 'vitest'
import { buildQualifyingOrder } from '@/engine/race/grid-builder'
import { simulateQualifying } from '@/engine/qualifying/quali-engine'
import type { BootstrapDriverInput, Circuit, TireCompound } from '@/types/race'
import type { QualifyingResult } from '@/types/weekend'

// Minimal classification factory — buildQualifyingOrder only reads `gridOrder`.
// All other fields are present (for type-correctness) but irrelevant here.
function classificationWith(gridOrder: string[]): QualifyingResult {
  return {
    format: 'qualifying',
    round: 1,
    segments: [],
    gridOrder,
    bestTimes: {},
    pole: { driverId: gridOrder[0] ?? '', time: null },
    fastestLap: null,
    seed: 0,
  }
}

describe('buildQualifyingOrder', () => {
  it('returns a COPY of inputOrder when classification is null (defensive fallback)', () => {
    const input = ['a', 'b', 'c']
    const out = buildQualifyingOrder(input, null)
    expect(out).toEqual(['a', 'b', 'c'])
    expect(out).not.toBe(input) // pure: never aliases the caller's array
  })

  it('reorders the input to match the earned grid order', () => {
    const out = buildQualifyingOrder(['a', 'b', 'c'], classificationWith(['c', 'a', 'b']))
    expect(out).toEqual(['c', 'a', 'b'])
  })

  it('follows the classification order regardless of how inputOrder is ordered', () => {
    const out = buildQualifyingOrder(['b', 'a', 'c'], classificationWith(['c', 'a', 'b']))
    expect(out).toEqual(['c', 'a', 'b'])
  })

  it('appends an input driver absent from the classification to the back', () => {
    // 'd' (e.g. a ban substitute) never ran qualifying.
    const out = buildQualifyingOrder(['a', 'b', 'c', 'd'], classificationWith(['c', 'a', 'b']))
    expect(out).toEqual(['c', 'a', 'b', 'd'])
  })

  it('appends multiple absent input drivers preserving their input order (stable)', () => {
    const out = buildQualifyingOrder(['x', 'a', 'y', 'b'], classificationWith(['b', 'a']))
    expect(out).toEqual(['b', 'a', 'x', 'y'])
  })

  it('drops classified drivers that are absent from the input (post-ban removal)', () => {
    // 'b' qualified but is no longer in the race lineup.
    const out = buildQualifyingOrder(['a', 'c'], classificationWith(['c', 'b', 'a']))
    expect(out).toEqual(['c', 'a'])
  })

  it('handles a single-car field', () => {
    expect(buildQualifyingOrder(['solo'], classificationWith(['solo']))).toEqual(['solo'])
  })

  it('handles an empty input order', () => {
    expect(buildQualifyingOrder([], classificationWith(['a', 'b']))).toEqual([])
  })

  it('round-trips a full 20-car grid (every input id classified)', () => {
    const grid = Array.from({ length: 20 }, (_, i) => `d${i}`)
    const input = [...grid].reverse()
    const out = buildQualifyingOrder(input, classificationWith(grid))
    expect(out).toEqual(grid) // grid order wins; all 20 present
    expect(out).toHaveLength(20)
  })

  it('is a pure, stable function — identical output across repeated calls', () => {
    const input = ['a', 'b', 'c', 'd']
    const cls = classificationWith(['d', 'b'])
    const first = buildQualifyingOrder(input, cls)
    const second = buildQualifyingOrder(input, cls)
    expect(second).toEqual(first)
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))
  })

  it('does not mutate its inputs', () => {
    const input = ['a', 'b', 'c']
    const grid = ['c', 'a', 'b']
    const cls = classificationWith([...grid])
    buildQualifyingOrder(input, cls)
    expect(input).toEqual(['a', 'b', 'c'])
    expect(cls.gridOrder).toEqual(grid)
  })
})

// ─── Determinism through the qualifying engine ──────────────────────────────
// AGENTS.md mandate: any change under src/engine/race/** must have a seeded
// twice-run test asserting byte-identical output. grid-builder consumes the
// qualifying classification, so we drive the engine twice and build the grid
// twice. (Full WORKER twice-run is M6.)
describe('buildQualifyingOrder — determinism through simulateQualifying', () => {
  function driver(id: string, rating: number): BootstrapDriverInput {
    return {
      id,
      teamId: `t-${id}`,
      shortName: id.slice(0, 3).toUpperCase(),
      attributes: {
        pace: rating,
        racecraft: 70,
        experience: 60,
        mentality: 70,
        marketability: 50,
        developmentPotential: 50,
      },
      mood: { motivation: 70, frustration: 30, confidence: 70 },
      car: {
        downforce: rating,
        straightSpeed: rating,
        reliability: rating,
        tireManagement: rating,
        braking: rating,
        cornering: rating,
      },
    }
  }
  function circuit(): Circuit {
    return {
      id: 'c',
      name: 'Test',
      country: 'X',
      laps: 50,
      downforceLevel: 'medium',
      tireWear: 'medium',
      overtakingDifficulty: 'medium',
      weatherVariability: 'medium',
      sectorCount: 3,
      compounds: ['C3', 'C4', 'C5'],
    }
  }
  const drivers = () => Array.from({ length: 20 }, (_, i) => driver(`d${i}`, 50 + i))
  const ledger = () => ({ remaining: { C3: 3, C4: 4, C5: 30 } as Partial<Record<TireCompound, number>> })
  const args = () => ({
    format: 'qualifying' as const,
    round: 7,
    raceSeed: 24680,
    drivers: drivers(),
    circuit: circuit(),
    setup: {},
    ledger: ledger(),
  })

  it('produces a byte-identical grid + classification across two seeded runs', () => {
    const run1 = simulateQualifying(args())
    const run2 = simulateQualifying(args())
    const input = drivers().map((d) => d.id)
    const grid1 = buildQualifyingOrder(input, run1.result)
    const grid2 = buildQualifyingOrder(input, run2.result)
    expect(grid2).toEqual(grid1)
    expect(JSON.stringify(run2.result)).toBe(JSON.stringify(run1.result))
  })

  it('builds the grid from the earned order, not roster order', () => {
    const input = drivers().map((d) => d.id)
    const { result } = simulateQualifying(args())
    const grid = buildQualifyingOrder(input, result)
    expect(grid).toEqual(result.gridOrder)
    expect(JSON.stringify(grid)).not.toBe(JSON.stringify(input))
  })
})
