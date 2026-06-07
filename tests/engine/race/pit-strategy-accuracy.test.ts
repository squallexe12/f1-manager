/**
 * M6 — tire-deg read accuracy shapes strategy-recommendation QUALITY (not which
 * strategy wins). Two distinct effects, both derived from the player's
 * accumulated `tireDegRead` (0..100):
 *
 *  1. Optimum-window NOISE — only when a seeded PRNG is supplied. A poor read
 *     (low accuracy) jitters the optimum pit lap by up to ±5 laps; a perfect
 *     read (100) is noiseless. The pit-loss calibration that decides which
 *     option is best is untouched — only the team's *read* of the window moves.
 *  2. Probability CONFIDENCE scaling — a better read raises the displayed
 *     probabilities. Deterministic, no PRNG.
 *
 * Critically: the noise PRNG is the only randomness, and it is OPTIONAL — the
 * live Strategy Room passes accuracy but no PRNG, so zero draws are added to
 * the authoritative race stream.
 */
import { describe, it, expect, vi } from 'vitest'
import { calculateStrategyOptions } from '@/engine/race/pit-strategy'
import { createPRNG } from '@/engine/core/prng'

const BASE = {
  currentLap: 10,
  totalLaps: 50,
  tireWear: 80,
  compound: 'C3' as const,
  circuitTireWear: 'medium' as const,
}

describe('pit strategy — tire-deg read accuracy (M6)', () => {
  it('accuracy 100 keeps the optimum pit lap on the noiseless truth even with a PRNG', () => {
    const truth = calculateStrategyOptions(BASE).find((o) => o.type === 'optimum')!
    const acc100 = calculateStrategyOptions({ ...BASE, tireDegReadAccuracy: 100, prng: createPRNG(123) })
      .find((o) => o.type === 'optimum')!
    expect(acc100.pitLap).toBe(truth.pitLap)
  })

  it('accuracy 0 jitters the optimum pit lap across seeds within a 3–10 lap spread', () => {
    const laps = new Set<number>()
    for (let seed = 1; seed <= 60; seed++) {
      const o = calculateStrategyOptions({ ...BASE, tireDegReadAccuracy: 0, prng: createPRNG(seed) })
        .find((x) => x.type === 'optimum')!
      laps.add(o.pitLap)
    }
    const sorted = [...laps].sort((a, b) => a - b)
    const spread = sorted[sorted.length - 1] - sorted[0]
    expect(spread).toBeGreaterThanOrEqual(3)
    expect(spread).toBeLessThanOrEqual(10)
  })

  it('higher accuracy yields higher option probabilities (confidence scaling)', () => {
    const low = calculateStrategyOptions({ ...BASE, tireDegReadAccuracy: 0 }).find((o) => o.type === 'optimum')!
    const high = calculateStrategyOptions({ ...BASE, tireDegReadAccuracy: 100 }).find((o) => o.type === 'optimum')!
    expect(high.probability).toBeGreaterThan(low.probability)
  })

  it('does NOT reorder which strategy wins — optimum stays the highest-probability option at any accuracy', () => {
    for (const acc of [0, 50, 100]) {
      const opts = calculateStrategyOptions({ ...BASE, tireDegReadAccuracy: acc })
      const best = [...opts].sort((a, b) => b.probability - a.probability)[0]
      expect(best.type).toBe('optimum')
    }
  })

  it('always returns exactly 3 options regardless of accuracy/noise', () => {
    expect(calculateStrategyOptions({ ...BASE, tireDegReadAccuracy: 0, prng: createPRNG(5) })).toHaveLength(3)
    expect(calculateStrategyOptions({ ...BASE, tireDegReadAccuracy: 100 })).toHaveLength(3)
  })

  it('uses no Math.random — seeded PRNG only', () => {
    const spy = vi.spyOn(Math, 'random')
    calculateStrategyOptions({ ...BASE, tireDegReadAccuracy: 0, prng: createPRNG(9) })
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('clamps accuracy outside [0,100]: -50 behaves as 0, 150 behaves as 100', () => {
    // Same seed per pair so any noise draw is identical — the only thing under
    // test is the clamp (probScaleFactor + noiseRange both saturate).
    expect(calculateStrategyOptions({ ...BASE, tireDegReadAccuracy: -50, prng: createPRNG(7) }))
      .toEqual(calculateStrategyOptions({ ...BASE, tireDegReadAccuracy: 0, prng: createPRNG(7) }))
    expect(calculateStrategyOptions({ ...BASE, tireDegReadAccuracy: 150, prng: createPRNG(7) }))
      .toEqual(calculateStrategyOptions({ ...BASE, tireDegReadAccuracy: 100, prng: createPRNG(7) }))
  })

  it('stays stable (3 options, no throw) when noise is applied near the end of the race', () => {
    // remainingLaps = 2; the noise path is genuinely new here. Offsets may go
    // nonsensical (pre-existing behaviour) but the function must not throw and
    // must always return the three labelled options.
    for (let seed = 1; seed <= 10; seed++) {
      const opts = calculateStrategyOptions({
        ...BASE, currentLap: 48, totalLaps: 50, tireDegReadAccuracy: 0, prng: createPRNG(seed),
      })
      expect(opts).toHaveLength(3)
      expect(opts.map((o) => o.type)).toEqual(['undercut', 'optimum', 'overcut'])
    }
  })
})
