import type { Contract, Driver } from '@/types/driver'
import type { FullGameState } from '@/engine/core/state-manager'
import { salariesSpent } from '@/engine/drivers/contract-engine'
import { recordSpend, setCategorySpent } from '@/engine/finance/budget-engine'

/** Fraction of remaining contract value paid as severance when no release clause is set. */
export const SEVERANCE_FRACTION = 0.5

/**
 * Cost to terminate a contract early.
 * - If a release clause is set (including 0), the clause is the severance.
 * - Otherwise, a fraction of the remaining salary owed (salary × seasons left).
 *
 * `termEndSeason` is relative seasons remaining (1 = final season), so
 * `salary × termEndSeason` is the total remaining salary owed.
 * Assumes an active contract (termEndSeason ≥ 1); callers guard that the
 * driver has a contract before calling.
 */
export function computeSeverance(contract: Contract): number {
  if (contract.releaseClause != null) return contract.releaseClause
  return Math.round(contract.salary * contract.termEndSeason * SEVERANCE_FRACTION)
}

export interface ReleaseResult {
  world: FullGameState
  releasedDriver: Driver
  severance: number
}

/**
 * Terminate a contracted player driver early. Pure (returns new world).
 *
 * - Driver → free agency: { teamId: null, contract: null, isReserve: false }.
 * - Salaries category recomputed from contract truth (drops).
 * - Severance charged to Operations (additive — survives later Salaries recomputes).
 *
 * Throws when the driver is not found, is not on the player team, or has no contract.
 */
export function releaseDriver(
  world: FullGameState,
  playerTeamId: string,
  driverId: string,
): ReleaseResult {
  const driver = world.drivers.find((d) => d.id === driverId)
  if (!driver) {
    throw new Error(`releaseDriver: driver ${driverId} not found`)
  }
  if (driver.teamId !== playerTeamId) {
    throw new Error(`releaseDriver: driver ${driverId} is not on the player team`)
  }
  if (!driver.contract) {
    throw new Error(`releaseDriver: driver ${driverId} has no contract to release`)
  }

  const severance = computeSeverance(driver.contract)

  const drivers = world.drivers.map((d) =>
    d.id === driverId ? { ...d, teamId: null, contract: null, isReserve: false } : d,
  )

  const fs = world.finance[playerTeamId]
  let budget = setCategorySpent(fs.budget, 'Salaries', salariesSpent(drivers, playerTeamId))
  budget = recordSpend(budget, 'Operations', severance)
  const finance = { ...world.finance, [playerTeamId]: { ...fs, budget } }

  return {
    world: { ...world, drivers, finance },
    releasedDriver: drivers.find((d) => d.id === driverId)!,
    severance,
  }
}
