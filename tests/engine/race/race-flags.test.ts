import { describe, it, expect } from 'vitest'
import { createPRNG } from '@/engine/core/prng'
import type { RaceFlag } from '@/types/race'
import {
  rollCautionFlag,
  cautionDurationLaps,
  DEFAULT_CAUTION_CONFIG,
  advanceRaceFlags,
} from '@/engine/race/race-flags'

describe('rollCautionFlag', () => {
  it('returns a non-green flag for any seed', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const flag = rollCautionFlag(createPRNG(seed), DEFAULT_CAUTION_CONFIG, 'minor')
      expect(['yellow', 'vsc', 'sc', 'red']).toContain(flag)
    }
  })

  it('is deterministic for a given seed', () => {
    expect(rollCautionFlag(createPRNG(7), DEFAULT_CAUTION_CONFIG, 'minor')).toBe(
      rollCautionFlag(createPRNG(7), DEFAULT_CAUTION_CONFIG, 'minor'),
    )
  })

  it('skews toward yellow/vsc over sc/red across a large sample', () => {
    const counts: Record<string, number> = { yellow: 0, vsc: 0, sc: 0, red: 0 }
    for (let seed = 1; seed <= 1000; seed++) {
      counts[rollCautionFlag(createPRNG(seed), DEFAULT_CAUTION_CONFIG, 'minor')]++
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

describe('advanceRaceFlags', () => {
  it('green + no trigger stays green and draws zero PRNG', () => {
    const rng = createPRNG(99)
    rng.next() // advance rng by one draw to align with rng2 after alignment call
    const rng2 = createPRNG(99)
    rng2.next() // align: we will assert the function below consumed nothing extra
    const result = advanceRaceFlags(
      { safetyCar: 'green', cautionLapsRemaining: 0 },
      rng2,
      null,
      DEFAULT_CAUTION_CONFIG,
    )
    expect(result.safetyCar).toBe('green')
    expect(result.cautionLapsRemaining).toBe(0)
    expect(result.deployed).toBeNull()
    expect(result.cleared).toBe(false)
    // rng2 has consumed exactly one value (the alignment call); the next draw
    // must equal rng's next draw from the parallel stream → proves zero extra draws.
    expect(rng2.next()).toBe(rng.next())
  })

  it('green + trigger deploys a caution and sets the duration', () => {
    const result = advanceRaceFlags(
      { safetyCar: 'green', cautionLapsRemaining: 0 },
      createPRNG(7),
      'minor',
      DEFAULT_CAUTION_CONFIG,
    )
    expect(result.safetyCar).not.toBe('green')
    expect(result.deployed).toBe(result.safetyCar)
    expect(result.cautionLapsRemaining).toBe(
      cautionDurationLaps(result.safetyCar as Exclude<typeof result.safetyCar, 'green'>, DEFAULT_CAUTION_CONFIG),
    )
    expect(result.cleared).toBe(false)
  })

  it('under caution + a new trigger does NOT redeploy or draw (already cautioned)', () => {
    const rng = createPRNG(3)
    const peek = createPRNG(3)
    const result = advanceRaceFlags(
      { safetyCar: 'sc', cautionLapsRemaining: 3 },
      rng,
      'major',
      DEFAULT_CAUTION_CONFIG,
    )
    expect(result.safetyCar).toBe('sc')
    expect(result.cautionLapsRemaining).toBe(2) // decremented
    expect(result.deployed).toBeNull()
    expect(rng.next()).toBe(peek.next()) // no extra draw consumed
  })

  it('decrements each lap and returns to green when the counter hits zero', () => {
    let s = { safetyCar: 'vsc' as RaceFlag, cautionLapsRemaining: 2 }
    let r = advanceRaceFlags(s, createPRNG(1), null, DEFAULT_CAUTION_CONFIG)
    expect(r.safetyCar).toBe('vsc')
    expect(r.cautionLapsRemaining).toBe(1)
    expect(r.cleared).toBe(false)
    s = { safetyCar: r.safetyCar, cautionLapsRemaining: r.cautionLapsRemaining }
    r = advanceRaceFlags(s, createPRNG(1), null, DEFAULT_CAUTION_CONFIG)
    expect(r.safetyCar).toBe('green')
    expect(r.cautionLapsRemaining).toBe(0)
    expect(r.cleared).toBe(true)
  })
})

describe('rollCautionFlag — cause-biased severity', () => {
  function tally(severity: 'minor' | 'major') {
    const counts = { yellow: 0, vsc: 0, sc: 0, red: 0 }
    for (let s = 1; s <= 4000; s++) {
      counts[rollCautionFlag(createPRNG(s), DEFAULT_CAUTION_CONFIG, severity)]++
    }
    return counts
  }

  it('minor severity leans yellow/VSC; full SC is uncommon', () => {
    const minor = tally('minor')
    expect(minor.yellow).toBeGreaterThan(minor.sc)
    expect(minor.vsc).toBeGreaterThan(minor.red)
  })

  it('major severity (heavy shunt) leans toward a full safety car', () => {
    const major = tally('major')
    // SC is the dominant outcome of a heavy shunt...
    expect(major.sc).toBeGreaterThan(major.yellow)
    expect(major.sc).toBeGreaterThan(major.vsc)
    // ...and far more likely than under a minor caution.
    const minor = tally('minor')
    expect(major.sc).toBeGreaterThan(minor.sc)
  })
})
