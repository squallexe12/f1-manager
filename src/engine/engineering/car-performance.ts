import type { CarPerformance, RndUpgrade } from '@/types/team'

/**
 * Calculate the current car performance by applying all completed upgrades to the base stats.
 */
export function calculateCarPerformance(
  baseCar: CarPerformance,
  upgrades: RndUpgrade[],
): CarPerformance {
  const result = { ...baseCar }

  for (const upgrade of upgrades) {
    if (upgrade.status !== 'complete') continue

    const delta = upgrade.performanceDelta
    if (delta.downforce) result.downforce = clamp(result.downforce + delta.downforce)
    if (delta.straightSpeed) result.straightSpeed = clamp(result.straightSpeed + delta.straightSpeed)
    if (delta.reliability) result.reliability = clamp(result.reliability + delta.reliability)
    if (delta.tireManagement) result.tireManagement = clamp(result.tireManagement + delta.tireManagement)
    if (delta.braking) result.braking = clamp(result.braking + delta.braking)
    if (delta.cornering) result.cornering = clamp(result.cornering + delta.cornering)
  }

  return result
}

/**
 * Calculate overall car rating (weighted average of all axes).
 */
export function calculateOverallRating(car: CarPerformance): number {
  return Math.round(
    (car.downforce * 0.20 +
     car.straightSpeed * 0.20 +
     car.reliability * 0.15 +
     car.tireManagement * 0.15 +
     car.braking * 0.15 +
     car.cornering * 0.15)
  )
}

function clamp(val: number): number {
  return Math.max(0, Math.min(100, val))
}
