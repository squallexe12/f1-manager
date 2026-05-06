import type { DriverAttributes } from '@/types/driver'

/**
 * Composite "overall" rating used in the broadcast UI. Formula matches
 * the reference design (new-designs/drivers/Drivers Page.html).
 *
 * Pure, presentation-only. Engine state never depends on this number.
 */
export function computeDriverOvr(a: DriverAttributes): number {
  return Math.round(
    (a.pace * 1.3 + a.racecraft * 1.2 + a.experience * 0.8 +
      a.mentality * 0.7 + a.marketability * 0.3 + a.developmentPotential * 0.2) / 4.5,
  )
}
