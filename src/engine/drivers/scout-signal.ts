import type { Driver, ScoutSignal } from '@/types/driver'

/**
 * Compute the scout-pool signal for a driver. Pure function.
 *
 * Branch order (first match wins):
 *   1. scoutingReports >= 8           → hot
 *   2. pace >= 85 && devPot >= 85     → hot
 *   3. scoutingReports >= 4           → tracking
 *   4. isF2 && devPot >= 75           → tracking
 *   5. otherwise                      → available
 *
 * Computed for every driver but semantically meaningful only for free agents
 * (teamId === null) or F2 prospects. Contracted drivers carry the signal
 * silently for type safety.
 */
export function computeScoutSignal(driver: Driver): ScoutSignal {
  if (driver.scoutingReports >= 8) return 'hot'
  if (driver.attributes.pace >= 85 && driver.attributes.developmentPotential >= 85) return 'hot'
  if (driver.scoutingReports >= 4) return 'tracking'
  if (driver.isF2 && driver.attributes.developmentPotential >= 75) return 'tracking'
  return 'available'
}
