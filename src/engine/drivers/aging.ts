import type { Driver, DriverAttributes } from '@/types/driver'

/**
 * Apply one season of aging to a driver's attributes.
 * Before peak age: attributes improve (scaled by developmentPotential).
 * After peak age: gradual decline (scaled by declineRate).
 */
export function applyAging(driver: Driver): DriverAttributes {
  const { attributes, age, peakAge, declineRate } = driver
  const newAttrs = { ...attributes }

  if (age < peakAge) {
    // Pre-peak: improvement
    const improvementRate = (attributes.developmentPotential / 100) * 1.5
    const yearsToPeak = peakAge - age

    // Pace and racecraft improve most for young drivers
    newAttrs.pace = clamp(attributes.pace + improvementRate * 0.8)
    newAttrs.racecraft = clamp(attributes.racecraft + improvementRate * 0.6)
    newAttrs.experience = clamp(attributes.experience + 3) // always grows
    newAttrs.mentality = clamp(attributes.mentality + improvementRate * 0.4)

    // Development potential decreases as they approach peak
    newAttrs.developmentPotential = Math.max(0,
      attributes.developmentPotential - (attributes.developmentPotential / yearsToPeak) * 0.3
    )
  } else {
    // Post-peak: decline
    const yearsOverPeak = age - peakAge
    const declineFactor = declineRate * (1 + yearsOverPeak * 0.1)

    newAttrs.pace = clamp(attributes.pace - declineFactor)
    newAttrs.racecraft = clamp(attributes.racecraft - declineFactor * 0.3) // experience compensates
    newAttrs.experience = clamp(attributes.experience + 1) // still grows, slowly
    newAttrs.mentality = clamp(attributes.mentality - declineFactor * 0.2)
    newAttrs.developmentPotential = Math.max(0, attributes.developmentPotential - 5)
  }

  return newAttrs
}

function clamp(val: number): number {
  return Math.max(0, Math.min(100, Math.round(val * 10) / 10))
}
