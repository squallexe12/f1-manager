import type { DriverAttributes } from '@/types/driver'

/**
 * Aggregate a driver's six attributes into a single 0-100 "overall" rating,
 * used by the Paddock driver card for the compact `Rating` stat. The weights
 * prioritize raw on-track performance (pace + racecraft) over off-track
 * factors (marketability), matching how scouts and engineers grade talent.
 *
 * Pure function. Deterministic. No PRNG.
 */
export function calculateOverallRating(attrs: DriverAttributes): number {
  const weighted =
    attrs.pace * 0.30 +
    attrs.racecraft * 0.25 +
    attrs.experience * 0.15 +
    attrs.mentality * 0.15 +
    attrs.marketability * 0.05 +
    attrs.developmentPotential * 0.10
  return Math.round(Math.max(0, Math.min(100, weighted)))
}
