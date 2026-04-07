import type { DriverAttributes, Mood } from '@/types/driver'

export interface EffectivePerformance {
  effectivePace: number
  consistency: number    // lower = more consistent
  wheelToWheel: number   // overtake/defend effectiveness
  tireManagement: number // how gently they treat tires
}

/**
 * Calculate a driver's effective race performance from their raw attributes + current mood.
 */
export function calculateEffectivePerformance(
  attributes: DriverAttributes,
  mood: Mood,
): EffectivePerformance {
  // High motivation = pace bonus (up to +3 at 100 motivation)
  const motivationBonus = (mood.motivation - 50) / 50 * 3

  // High frustration = consistency penalty (more errors)
  const frustrationPenalty = (mood.frustration / 100) * 4

  // Low confidence = wheel-to-wheel penalty
  const confidenceBonus = (mood.confidence - 50) / 50 * 5

  const effectivePace = Math.max(0, Math.min(100,
    attributes.pace + motivationBonus
  ))

  const consistency = Math.max(0.5, 5 - (attributes.experience / 100) * 3 + frustrationPenalty)

  const wheelToWheel = Math.max(0, Math.min(100,
    attributes.racecraft + confidenceBonus
  ))

  const tireManagement = Math.max(0, Math.min(100,
    (attributes.experience * 0.4 + attributes.mentality * 0.3 + (100 - mood.frustration) * 0.3)
  ))

  return { effectivePace, consistency, wheelToWheel, tireManagement }
}
