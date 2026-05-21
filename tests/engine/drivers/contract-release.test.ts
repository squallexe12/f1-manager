import { describe, expect, it } from 'vitest'
import { computeSeverance, SEVERANCE_FRACTION } from '@/engine/drivers/contract-release'
import type { Contract } from '@/types/driver'

const contract = (overrides: Partial<Contract> = {}): Contract => ({
  salary: 20_000_000,
  termEndSeason: 2,
  performanceBonuses: [],
  releaseClause: null,
  ...overrides,
})

describe('computeSeverance', () => {
  it('returns the release clause when one is set', () => {
    expect(computeSeverance(contract({ releaseClause: 30_000_000 }))).toBe(30_000_000)
  })

  it('returns a fraction of remaining contract value when no clause', () => {
    // 20M salary × 2 seasons × 0.5 = 20M
    expect(computeSeverance(contract({ salary: 20_000_000, termEndSeason: 2 }))).toBe(
      Math.round(20_000_000 * 2 * SEVERANCE_FRACTION),
    )
  })

  it('rounds the fractional severance to an integer', () => {
    const result = computeSeverance(contract({ salary: 15_500_001, termEndSeason: 1 }))
    expect(Number.isInteger(result)).toBe(true)
  })

  it('a release clause of 0 is honored (not treated as "no clause")', () => {
    expect(computeSeverance(contract({ releaseClause: 0 }))).toBe(0)
  })

  it('final-season driver with no clause owes half a single season of salary', () => {
    // termEndSeason 1 = final season → 24M × 1 × 0.5 = 12M
    expect(computeSeverance(contract({ salary: 24_000_000, termEndSeason: 1 }))).toBe(12_000_000)
  })
})
