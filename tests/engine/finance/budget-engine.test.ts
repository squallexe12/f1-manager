import { describe, it, expect } from 'vitest'
import { recordSpend, checkCapBreach, calculatePrizeMoney } from '@/engine/finance/budget-engine'
import type { Budget } from '@/types/finance'

function mockBudget(): Budget {
  return {
    cap: 215_000_000,
    totalSpent: 0,
    categories: [
      { name: 'R&D', allocated: 80_000_000, spent: 0 },
      { name: 'Salaries', allocated: 60_000_000, spent: 0 },
      { name: 'Operations', allocated: 45_000_000, spent: 0 },
    ],
    projectedEndOfSeason: 0,
    penaltyRisk: false,
  }
}

describe('budget engine', () => {
  it('spending updates budget correctly', () => {
    const budget = mockBudget()
    const updated = recordSpend(budget, 'R&D', 10_000_000)
    expect(updated.totalSpent).toBe(10_000_000)
    expect(updated.categories[0].spent).toBe(10_000_000)
  })

  it('category breakdown sums to total', () => {
    let budget = mockBudget()
    budget = recordSpend(budget, 'R&D', 50_000_000)
    budget = recordSpend(budget, 'Salaries', 30_000_000)
    budget = recordSpend(budget, 'Operations', 20_000_000)
    const catSum = budget.categories.reduce((s, c) => s + c.spent, 0)
    expect(catSum).toBe(budget.totalSpent)
  })

  it('over-cap triggers penalty flag', () => {
    let budget = mockBudget()
    budget = recordSpend(budget, 'R&D', 200_000_000)
    expect(budget.penaltyRisk).toBe(true)
  })

  it('checkCapBreach returns correct penalty for overspend', () => {
    const budget = { ...mockBudget(), totalSpent: 220_000_000 }
    const result = checkCapBreach(budget)
    expect(result.breached).toBe(true)
    expect(result.overspend).toBe(5_000_000)
    expect(result.penaltyTier).toBe('minor')
  })

  it('season-end prize money works', () => {
    const first = calculatePrizeMoney(1)
    const last = calculatePrizeMoney(11)
    expect(first).toBeGreaterThan(last)
    expect(first).toBe(130_000_000) // 50M base + 80M performance
  })
})
