import { describe, it, expect } from 'vitest'
import { createPRNG } from '@/engine/core/prng'

describe('createPRNG', () => {
  it('produces deterministic results from same seed', () => {
    const rng1 = createPRNG(12345)
    const rng2 = createPRNG(12345)
    const results1 = Array.from({ length: 10 }, () => rng1.next())
    const results2 = Array.from({ length: 10 }, () => rng2.next())
    expect(results1).toEqual(results2)
  })

  it('produces different results from different seeds', () => {
    const rng1 = createPRNG(12345)
    const rng2 = createPRNG(54321)
    expect(rng1.next()).not.toEqual(rng2.next())
  })

  it('returns values between 0 and 1', () => {
    const rng = createPRNG(42)
    for (let i = 0; i < 100; i++) {
      const val = rng.next()
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThan(1)
    }
  })

  it('range() returns values in specified range', () => {
    const rng = createPRNG(42)
    for (let i = 0; i < 100; i++) {
      const val = rng.range(10, 20)
      expect(val).toBeGreaterThanOrEqual(10)
      expect(val).toBeLessThanOrEqual(20)
    }
  })

  it('chance() returns boolean based on probability', () => {
    const rng = createPRNG(42)
    expect(rng.chance(1.0)).toBe(true)
    expect(rng.chance(0.0)).toBe(false)
  })

  it('pick() selects from array', () => {
    const rng = createPRNG(42)
    const items = ['a', 'b', 'c']
    const picked = rng.pick(items)
    expect(items).toContain(picked)
  })
})
