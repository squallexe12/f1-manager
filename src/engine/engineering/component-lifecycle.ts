import type { ComponentAllocation } from '@/types/team'
import type { PRNG } from '@/engine/core/prng'

/**
 * Use a component for one race weekend. Increments usage counter.
 */
export function useComponent(component: ComponentAllocation): ComponentAllocation {
  return {
    ...component,
    used: component.used + 1,
  }
}

/**
 * Check if using a new component would exceed the allocation limit.
 * Returns the number of grid penalty positions (0 = no penalty).
 */
export function getGridPenalty(component: ComponentAllocation): number {
  if (component.used < component.limit) return 0
  // First excess: 10 places. Each subsequent: 5 places.
  const excess = component.used - component.limit
  if (excess === 0) return 10
  return 10 + (excess) * 5
}

/**
 * Calculate total grid penalties across all components for a new element introduction.
 */
export function calculateTotalPenalty(components: ComponentAllocation[]): number {
  return components.reduce((total, comp) => {
    if (comp.used >= comp.limit) {
      return total + getGridPenalty(comp)
    }
    return total
  }, 0)
}

/**
 * Check if a mechanical failure occurs during a race.
 * Failure probability increases with usage and is reduced by reliability upgrades.
 */
export function checkMechanicalFailure(
  components: ComponentAllocation[],
  reliabilityRating: number, // 0-100, from car performance
  rng: PRNG,
): { failed: boolean; failedComponent: string | null } {
  for (const comp of components) {
    // Base probability from component data
    let failChance = comp.failureProbability

    // Usage increases failure risk as components age
    const usageRatio = comp.used / Math.max(1, comp.limit)
    failChance *= (1 + usageRatio * 0.5)

    // Reliability rating reduces failure chance
    failChance *= (1 - (reliabilityRating / 100) * 0.5)

    if (rng.chance(failChance)) {
      return { failed: true, failedComponent: comp.element }
    }
  }

  return { failed: false, failedComponent: null }
}
