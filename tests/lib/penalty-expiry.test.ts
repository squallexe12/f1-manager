import { describe, expect, it } from 'vitest'
import { computeExpiryRound } from '@/lib/utils/penalty-expiry'

describe('computeExpiryRound', () => {
  it('R5 + 22 rounds = R5 next season', () => {
    const e = computeExpiryRound(5, 2026, 22)
    expect(e.round).toBe(5)
    expect(e.season).toBe(2027)
  })

  it('R21 + 22 = R21 next season (not R43)', () => {
    const e = computeExpiryRound(21, 2026, 22)
    expect(e.round).toBe(21)
    expect(e.season).toBe(2027)
  })

  it('R1 + 22 = R1 next season', () => {
    const e = computeExpiryRound(1, 2026, 22)
    expect(e.round).toBe(1)
    expect(e.season).toBe(2027)
  })

  it('R22 + 22 = R22 next season', () => {
    const e = computeExpiryRound(22, 2026, 22)
    expect(e.round).toBe(22)
    expect(e.season).toBe(2027)
  })

  it('R10 + 22 = R10 next season', () => {
    const e = computeExpiryRound(10, 2026, 22)
    expect(e.round).toBe(10)
    expect(e.season).toBe(2027)
  })
})
