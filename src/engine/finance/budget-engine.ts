import type { Budget, BudgetCategory } from '@/types/finance'

/**
 * Record a spend in a category. Returns updated budget.
 */
export function recordSpend(budget: Budget, categoryName: string, amount: number): Budget {
  const categories = budget.categories.map(cat => {
    if (cat.name === categoryName) {
      return { ...cat, spent: cat.spent + amount }
    }
    return cat
  })

  const totalSpent = categories.reduce((sum, cat) => sum + cat.spent, 0)
  const penaltyRisk = totalSpent > budget.cap * 0.9

  return {
    ...budget,
    categories,
    totalSpent,
    penaltyRisk,
    projectedEndOfSeason: totalSpent, // simplified projection
  }
}

/**
 * Check if budget cap has been exceeded and calculate penalty tier.
 * Returns penalty details or null if under cap.
 */
export function checkCapBreach(budget: Budget): {
  breached: boolean
  overspend: number
  penaltyTier: 'minor' | 'significant' | 'material' | null
  constructorPointsDeduction: number
  windTunnelReduction: number // percentage
} {
  const overspend = budget.totalSpent - budget.cap

  if (overspend <= 0) {
    return { breached: false, overspend: 0, penaltyTier: null, constructorPointsDeduction: 0, windTunnelReduction: 0 }
  }

  const overspendPercent = (overspend / budget.cap) * 100

  if (overspendPercent < 5) {
    return {
      breached: true, overspend, penaltyTier: 'minor',
      constructorPointsDeduction: 25, windTunnelReduction: 10,
    }
  }
  if (overspendPercent < 10) {
    return {
      breached: true, overspend, penaltyTier: 'significant',
      constructorPointsDeduction: 50, windTunnelReduction: 20,
    }
  }
  return {
    breached: true, overspend, penaltyTier: 'material',
    constructorPointsDeduction: 100, windTunnelReduction: 30,
  }
}

/**
 * Set a category's spent value outright (vs. recordSpend's additive delta) and
 * recompute totals. Used when a category is derived from truth — e.g. 'Salaries'
 * recomputed from the sum of driver contracts after a renegotiation.
 */
export function setCategorySpent(budget: Budget, categoryName: string, value: number): Budget {
  const categories = budget.categories.map((cat) =>
    cat.name === categoryName ? { ...cat, spent: value } : cat,
  )
  const totalSpent = categories.reduce((sum, cat) => sum + cat.spent, 0)
  return {
    ...budget,
    categories,
    totalSpent,
    penaltyRisk: totalSpent > budget.cap * 0.9,
    projectedEndOfSeason: totalSpent, // simplified projection
  }
}

/**
 * Calculate season-end prize money based on constructor position.
 */
export function calculatePrizeMoney(constructorPosition: number): number {
  // Column 1 (equal share) + Column 2 (performance-based)
  const baseShare = 50_000_000 // every team gets this
  const performancePrize: Record<number, number> = {
    1: 80_000_000, 2: 65_000_000, 3: 55_000_000, 4: 48_000_000, 5: 42_000_000,
    6: 38_000_000, 7: 34_000_000, 8: 30_000_000, 9: 26_000_000, 10: 22_000_000, 11: 18_000_000,
  }
  return baseShare + (performancePrize[constructorPosition] ?? 15_000_000)
}
