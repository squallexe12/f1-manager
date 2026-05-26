import { describe, it, expect } from 'vitest'
import { createPRNG } from '@/engine/core/prng'
import { evaluatePitLineCrossing, DEFAULT_PIT_LINE_CONFIG } from '@/engine/race/pit-line-crossing'

const input = (over: Partial<Parameters<typeof evaluatePitLineCrossing>[0]> = {}) => ({
  boundary: 'entry' as 'entry' | 'exit',
  experience: 70,
  config: DEFAULT_PIT_LINE_CONFIG,
  ...over,
})

describe('evaluatePitLineCrossing', () => {
  it('returns a boolean and is deterministic for a seed', () => {
    const a = evaluatePitLineCrossing(input(), createPRNG(4))
    const b = evaluatePitLineCrossing(input(), createPRNG(4))
    expect(typeof a).toBe('boolean')
    expect(a).toBe(b)
  })

  it('an inexperienced driver crosses more often than a veteran', () => {
    const count = (exp: number) => {
      let n = 0
      for (let s = 1; s <= 3000; s++) if (evaluatePitLineCrossing(input({ experience: exp }), createPRNG(s))) n++
      return n
    }
    expect(count(25)).toBeGreaterThan(count(95))
  })

  it('a veteran almost never crosses', () => {
    let n = 0
    for (let s = 1; s <= 5000; s++) if (evaluatePitLineCrossing(input({ experience: 98 }), createPRNG(s))) n++
    expect(n).toBeLessThan(120) // < ~2.4%
  })
})
