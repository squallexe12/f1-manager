import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { deriveSessionSeed, SESSION_SALT } from '@/engine/weekend/seed-derivation'
import { deriveRaceSeed } from '@/engine/race/race-bootstrap'
import { createPRNG } from '@/engine/core/prng'

/**
 * The weekend feature derives independent per-session PRNG streams off the
 * single per-round race seed (deriveRaceSeed(seed, round)) via a salt table.
 * These tests pin the determinism + independence contract from §4 of the plan.
 */
describe('deriveSessionSeed', () => {
  const raceSeed = deriveRaceSeed(12345, 5)

  it('is deterministic for the same (raceSeed, key)', () => {
    expect(deriveSessionSeed(raceSeed, 'FP1')).toBe(deriveSessionSeed(raceSeed, 'FP1'))
    expect(deriveSessionSeed(raceSeed, 'Q3')).toBe(deriveSessionSeed(raceSeed, 'Q3'))
  })

  it('produces distinct seeds for FP1 vs FP2 vs Q1 off the same race seed', () => {
    const fp1 = deriveSessionSeed(raceSeed, 'FP1')
    const fp2 = deriveSessionSeed(raceSeed, 'FP2')
    const q1 = deriveSessionSeed(raceSeed, 'Q1')
    expect(fp1).not.toBe(fp2)
    expect(fp1).not.toBe(q1)
    expect(fp2).not.toBe(q1)
  })

  it('produces pairwise-distinct seeds for all nine session keys', () => {
    const keys = Object.keys(SESSION_SALT)
    const seeds = keys.map((k) => deriveSessionSeed(raceSeed, k))
    expect(new Set(seeds).size).toBe(keys.length)
  })

  it('standard (Q*) and sprint (SQ*) segments resolve to distinct streams', () => {
    expect(deriveSessionSeed(raceSeed, 'Q1')).not.toBe(deriveSessionSeed(raceSeed, 'SQ1'))
    expect(deriveSessionSeed(raceSeed, 'Q2')).not.toBe(deriveSessionSeed(raceSeed, 'SQ2'))
    expect(deriveSessionSeed(raceSeed, 'Q3')).not.toBe(deriveSessionSeed(raceSeed, 'SQ3'))
  })

  it('practice, qualifying and race streams are independent (pairwise-distinct first 5 draws)', () => {
    const practice = createPRNG(deriveSessionSeed(raceSeed, 'FP1'))
    const quali = createPRNG(deriveSessionSeed(raceSeed, 'Q1'))
    // Match race-bootstrap.ts exactly: the real race PRNG is seeded raceSeed ^ 0x9e3779b9.
    const race = createPRNG(raceSeed ^ 0x9e3779b9)
    const draw5 = (p: ReturnType<typeof createPRNG>) =>
      Array.from({ length: 5 }, () => p.next())
    const a = draw5(practice)
    const b = draw5(quali)
    const c = draw5(race)
    expect(a).not.toEqual(b)
    expect(a).not.toEqual(c)
    expect(b).not.toEqual(c)
  })

  it('different race seeds yield different session seeds', () => {
    const other = deriveRaceSeed(99999, 5)
    expect(deriveSessionSeed(raceSeed, 'FP1')).not.toBe(deriveSessionSeed(other, 'FP1'))
  })

  it('does not contain the precision-unsafe bigint literal 6364136223846793005', () => {
    // Determinism hazard: 6364136223846793005 > Number.MAX_SAFE_INTEGER, so any
    // arithmetic on it loses precision before |0 — forbidden by plan §4.
    const here = dirname(fileURLToPath(import.meta.url))
    const src = readFileSync(
      resolve(here, '../../../src/engine/weekend/seed-derivation.ts'),
      'utf8',
    )
    expect(src).not.toContain('6364136223846793005')
  })
})
