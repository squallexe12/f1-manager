import type { Contract } from '@/types/driver'

/** Fraction of remaining contract value paid as severance when no release clause is set. */
export const SEVERANCE_FRACTION = 0.5

/**
 * Cost to terminate a contract early.
 * - If a release clause is set (including 0), the clause is the severance.
 * - Otherwise, a fraction of the remaining salary owed (salary × seasons left).
 *
 * `termEndSeason` is relative seasons remaining (1 = final season), so
 * `salary × termEndSeason` is the total remaining salary owed.
 */
export function computeSeverance(contract: Contract): number {
  if (contract.releaseClause != null) return contract.releaseClause
  return Math.round(contract.salary * contract.termEndSeason * SEVERANCE_FRACTION)
}
