import { describe, it, expect } from 'vitest'
import { createPRNG } from '@/engine/core/prng'
import {
  evaluateTrackLimitBreach,
  DEFAULT_TRACK_LIMITS_CONFIG,
} from '@/engine/race/track-limits'

const baseInput = (over: Partial<Parameters<typeof evaluateTrackLimitBreach>[0]> = {}) => ({
  difficultyTier: 3 as 1 | 2 | 3,
  experience: 70,
  frustration: 30,
  config: DEFAULT_TRACK_LIMITS_CONFIG,
  ...over,
})

describe('evaluateTrackLimitBreach', () => {
  it('returns a boolean and is deterministic for a seed', () => {
    const a = evaluateTrackLimitBreach(baseInput(), createPRNG(5))
    const b = evaluateTrackLimitBreach(baseInput(), createPRNG(5))
    expect(typeof a).toBe('boolean')
    expect(a).toBe(b)
  })

  it('a low-experience, highly-frustrated driver at a tier-3 corner breaches more often than a calm veteran at a tier-1 corner', () => {
    const count = (input: Parameters<typeof evaluateTrackLimitBreach>[0]) => {
      let n = 0
      for (let s = 1; s <= 2000; s++) if (evaluateTrackLimitBreach(input, createPRNG(s))) n++
      return n
    }
    const reckless = count(baseInput({ experience: 30, frustration: 95, difficultyTier: 3 }))
    const veteran = count(baseInput({ experience: 95, frustration: 5, difficultyTier: 1 }))
    expect(reckless).toBeGreaterThan(veteran)
  })

  it('never breaches at a tier with zero base rate (sanity floor)', () => {
    // difficultyTier 1 + max experience + zero frustration → near-zero rate, but bounded
    let n = 0
    for (let s = 1; s <= 5000; s++) {
      if (evaluateTrackLimitBreach(baseInput({ experience: 99, frustration: 0, difficultyTier: 1 }), createPRNG(s))) n++
    }
    expect(n).toBeLessThan(250) // < ~5% even worst-case seeds
  })
})
