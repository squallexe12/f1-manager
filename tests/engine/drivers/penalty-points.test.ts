import { describe, it, expect } from 'vitest'
import {
  entryExpiresAt,
  expirePenaltyPoints,
  sumActivePoints,
  wipeContributingPoints,
} from '@/engine/drivers/penalty-points'
import type { PenaltyPointEntry } from '@/types/driver'

const e = (points: number, season: number, round: number, raceId = 'r'): PenaltyPointEntry => ({
  points, issuedSeason: season, issuedRound: round, offenceType: 'collision-minor', raceId,
})

describe('expirePenaltyPoints', () => {
  it('keeps an entry inside the 22-round window', () => {
    const out = expirePenaltyPoints([e(2, 1, 5)], 1, 26)
    expect(out).toHaveLength(1)
  })

  it('drops an entry exactly at the 22-round boundary', () => {
    // round delta = 22 → expired (>= 22)
    const out = expirePenaltyPoints([e(2, 1, 5)], 1, 27)
    expect(out).toHaveLength(0)
  })

  it('cross-season expiry: entry from (1, 20) expires in (2, 20), not earlier', () => {
    const entry = e(1, 1, 20)
    expect(expirePenaltyPoints([entry], 2, 19)).toHaveLength(1)  // delta 21
    expect(expirePenaltyPoints([entry], 2, 20)).toHaveLength(0)  // delta 22
  })

  it('returns a new array, never mutates input', () => {
    const input = [e(1, 1, 1), e(1, 1, 2)]
    const before = [...input]
    expirePenaltyPoints(input, 5, 10)
    expect(input).toEqual(before)
  })
})

describe('sumActivePoints', () => {
  it('sums all entries (caller is expected to expire first)', () => {
    expect(sumActivePoints([e(1, 1, 1), e(2, 1, 2), e(3, 1, 3)])).toBe(6)
  })

  it('returns 0 for empty list', () => {
    expect(sumActivePoints([])).toBe(0)
  })
})

describe('entryExpiresAt', () => {
  it('returns the same season when issued round + window stays inside the season', () => {
    expect(entryExpiresAt(e(1, 1, 5), 10)).toEqual({ season: 1, round: 15 })
  })

  it('wraps into the next season when issued round + window exceeds the season', () => {
    // (1, 5) + 22 → (2, 5)
    expect(entryExpiresAt(e(1, 1, 5))).toEqual({ season: 2, round: 5 })
  })

  it('agrees with expirePenaltyPoints at the boundary: still active one round before expiry, gone on expiry', () => {
    const entry = e(2, 1, 20)
    const expiry = entryExpiresAt(entry)
    // One round before expiry: still active
    const before =
      expiry.round === 1
        ? { season: expiry.season - 1, round: 22 }
        : { season: expiry.season, round: expiry.round - 1 }
    expect(expirePenaltyPoints([entry], before.season, before.round)).toHaveLength(1)
    // On expiry round: removed
    expect(expirePenaltyPoints([entry], expiry.season, expiry.round)).toHaveLength(0)
  })

  it('handles a window larger than one season', () => {
    // (1, 10) + 25 → totalRound 35 → season+1, round 13
    expect(entryExpiresAt(e(1, 1, 10), 25)).toEqual({ season: 2, round: 13 })
  })
})

describe('wipeContributingPoints', () => {
  it('removes newest-first entries until cumulative >= threshold', () => {
    // newest first: (round 30, 5pts), (round 25, 4pts), (round 20, 3pts), (round 10, 2pts)
    const entries = [e(2, 1, 10), e(3, 1, 20), e(4, 1, 25), e(5, 1, 30)]
    const result = wipeContributingPoints(entries, 12)
    // 5 + 4 + 3 = 12 → drops the 3 newest; the round-10 entry survives
    expect(result).toHaveLength(1)
    expect(result[0].issuedRound).toBe(10)
  })

  it('keeps older entries that fall below the wipe sum', () => {
    const entries = [e(2, 1, 5), e(10, 1, 15)]
    const result = wipeContributingPoints(entries, 12)
    // newest (10) is taken first → sum 10, still below 12; next (2) brings to 12 → drop both
    expect(result).toHaveLength(0)
  })

  it('does nothing when total is below threshold', () => {
    const entries = [e(3, 1, 5), e(4, 1, 10)]
    const result = wipeContributingPoints(entries, 12)
    expect(result).toHaveLength(2)
  })

  it('handles ties deterministically (lower round first when sorting)', () => {
    const entries = [e(6, 1, 10), e(6, 1, 10)]
    const result = wipeContributingPoints(entries, 12)
    expect(result).toHaveLength(0)
  })
})
