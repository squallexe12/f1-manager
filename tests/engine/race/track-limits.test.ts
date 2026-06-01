import { describe, it, expect } from 'vitest'
import { createPRNG } from '@/engine/core/prng'
import {
  evaluateTrackLimitBreach,
  applyTrackLimitStrike,
  rollTrackLimitExposure,
  DEFAULT_TRACK_LIMITS_CONFIG,
  type TrackLimitsConfig,
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

describe('rollTrackLimitExposure (per-race "bad day" factor)', () => {
  it('DEFAULT config holds the normalMult < 1 < badDayMult invariant', () => {
    // A misconfigured exposure (e.g. badDayMult < 1) would silently distort the
    // calibration without erroring — pin the documented invariant so a future edit
    // that breaks it fails loudly here.
    const e = DEFAULT_TRACK_LIMITS_CONFIG.exposure
    expect(e.normalMult).toBeLessThan(1)
    expect(e.badDayMult).toBeGreaterThan(1)
  })

  it('returns badDayMult on a bad-day draw and normalMult otherwise', () => {
    const allBad: TrackLimitsConfig = {
      ...DEFAULT_TRACK_LIMITS_CONFIG,
      exposure: { badDayProb: 1, badDayMult: 3, normalMult: 0.5 },
    }
    expect(rollTrackLimitExposure(createPRNG(1), allBad)).toBe(3)
    const neverBad: TrackLimitsConfig = {
      ...DEFAULT_TRACK_LIMITS_CONFIG,
      exposure: { badDayProb: 0, badDayMult: 3, normalMult: 0.5 },
    }
    expect(rollTrackLimitExposure(createPRNG(1), neverBad)).toBe(0.5)
  })

  it('consumes exactly one PRNG draw', () => {
    const rng = createPRNG(7)
    const peek = createPRNG(7)
    rollTrackLimitExposure(rng, DEFAULT_TRACK_LIMITS_CONFIG)
    peek.next()
    expect(rng.next()).toBe(peek.next())
  })

  it('is deterministic for a seed', () => {
    expect(rollTrackLimitExposure(createPRNG(42), DEFAULT_TRACK_LIMITS_CONFIG)).toBe(
      rollTrackLimitExposure(createPRNG(42), DEFAULT_TRACK_LIMITS_CONFIG),
    )
  })
})

describe('evaluateTrackLimitBreach exposure factor', () => {
  it('a high exposure factor produces more breaches than a low one over many seeds', () => {
    const count = (exposureFactor: number) => {
      let n = 0
      for (let s = 1; s <= 3000; s++) {
        if (evaluateTrackLimitBreach(baseInput({ exposureFactor }), createPRNG(s))) n++
      }
      return n
    }
    expect(count(3)).toBeGreaterThan(count(0.2))
  })

  it('omitting exposureFactor is equivalent to exposureFactor = 1', () => {
    for (let s = 1; s <= 500; s++) {
      const withDefault = evaluateTrackLimitBreach(baseInput(), createPRNG(s))
      const withOne = evaluateTrackLimitBreach(baseInput({ exposureFactor: 1 }), createPRNG(s))
      expect(withDefault).toBe(withOne)
    }
  })
})

describe('applyTrackLimitStrike', () => {
  it('breaches 1-3 are warnings (no flag, no penalty)', () => {
    for (let n = 1; n <= 3; n++) {
      const r = applyTrackLimitStrike(n - 1, DEFAULT_TRACK_LIMITS_CONFIG)
      expect(r.strikes).toBe(n)
      expect(r.outcome).toBe('warning')
    }
  })

  it('the 4th breach shows the black-and-white flag (warning, not a penalty)', () => {
    const r = applyTrackLimitStrike(3, DEFAULT_TRACK_LIMITS_CONFIG)
    expect(r.strikes).toBe(4)
    expect(r.outcome).toBe('black-and-white')
    expect(r.timePenaltySeconds).toBe(0)
  })

  it('the 5th breach issues a 5s time penalty', () => {
    const r = applyTrackLimitStrike(4, DEFAULT_TRACK_LIMITS_CONFIG)
    expect(r.strikes).toBe(5)
    expect(r.outcome).toBe('time-penalty')
    expect(r.timePenaltySeconds).toBe(5)
  })

  it('6th+ continues issuing time penalties', () => {
    const r = applyTrackLimitStrike(5, DEFAULT_TRACK_LIMITS_CONFIG)
    expect(r.strikes).toBe(6)
    expect(r.outcome).toBe('time-penalty')
    expect(r.timePenaltySeconds).toBe(5)
  })
})
