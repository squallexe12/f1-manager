/**
 * Tier B v2 — sampling distributions for procgen pit-crew talent pool.
 *
 * Distribution shape per spec §5.10:
 *   - Chief attributes: gaussian(70, 15), clamped to [30, 99]
 *   - Member ratings:   gaussian(65, 18), clamped to [25, 99]
 *   - Salary scales linearly with attribute level.
 */

export const STAFF_POOL_DEFAULTS = {
  chiefs: 30,
  members: 80,
} as const

/** Distribution params for chief attribute axes. */
export const CHIEF_ATTR_DIST = {
  mean: 70,
  stddev: 15,
  min: 30,
  max: 99,
} as const

/** Distribution params for member rating. */
export const MEMBER_RATING_DIST = {
  mean: 65,
  stddev: 18,
  min: 25,
  max: 99,
} as const

/** Salary computed from attribute level. */
export const CHIEF_SALARY = {
  base: 200_000,
  perAttr: 50_000, // chief total = base + (avgAttr × perAttr)
} as const

export const MEMBER_SALARY = {
  base: 50_000,
  perRating: 10_000, // member total = base + (rating × perRating)
} as const

/** Default age range for procgen staff (years). */
export const STAFF_AGE_RANGE = {
  min: 28,
  max: 58,
} as const

/**
 * Salary tiers for free-agent display (cosmetic; UI banding only).
 * Engine logic uses raw salary numbers.
 */
export const SALARY_TIERS = {
  junior: 1_000_000,
  mid: 2_500_000,
  senior: 4_000_000,
  elite: Infinity,
} as const
