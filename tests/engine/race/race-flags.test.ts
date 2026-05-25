import { describe, it, expect } from 'vitest'
import { createPRNG } from '@/engine/core/prng'
import {
  rollCautionFlag,
  cautionDurationLaps,
  DEFAULT_CAUTION_CONFIG,
} from '@/engine/race/race-flags'

describe('rollCautionFlag', () => {
  it('returns a non-green flag for any seed', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const flag = rollCautionFlag(createPRNG(seed), DEFAULT_CAUTION_CONFIG)
      expect(['yellow', 'vsc', 'sc', 'red']).toContain(flag)
    }
  })

  it('is deterministic for a given seed', () => {
    expect(rollCautionFlag(createPRNG(7), DEFAULT_CAUTION_CONFIG)).toBe(
      rollCautionFlag(createPRNG(7), DEFAULT_CAUTION_CONFIG),
    )
  })

  it('skews toward yellow/vsc over sc/red across a large sample', () => {
    const counts: Record<string, number> = { yellow: 0, vsc: 0, sc: 0, red: 0 }
    for (let seed = 1; seed <= 1000; seed++) {
      counts[rollCautionFlag(createPRNG(seed), DEFAULT_CAUTION_CONFIG)]++
    }
    // yellow is the most common; red is the rarest.
    expect(counts.yellow).toBeGreaterThan(counts.sc)
    expect(counts.sc).toBeGreaterThan(counts.red)
    expect(counts.red).toBeGreaterThan(0)
  })
})

describe('cautionDurationLaps', () => {
  it('returns the configured duration per flag', () => {
    expect(cautionDurationLaps('yellow', DEFAULT_CAUTION_CONFIG)).toBe(1)
    expect(cautionDurationLaps('vsc', DEFAULT_CAUTION_CONFIG)).toBe(2)
    expect(cautionDurationLaps('sc', DEFAULT_CAUTION_CONFIG)).toBe(4)
    expect(cautionDurationLaps('red', DEFAULT_CAUTION_CONFIG)).toBe(3)
  })
})
