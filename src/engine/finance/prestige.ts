import type { PrestigeRating } from '@/types/finance'

export interface PrestigeInput {
  constructorPosition: number  // 1-11
  recentWins: number           // wins in last 5 races
  driverMarketabilityAvg: number // 0-100
  mediaPositiveEvents: number  // positive media events this season
  mediaNegativeEvents: number  // scandals, incidents
}

/**
 * Calculate prestige score (0-100) from team achievements.
 */
export function calculatePrestigeScore(input: PrestigeInput): number {
  let score = 0

  // Constructor position: 1st = 40pts, 11th = 0pts
  score += Math.max(0, (12 - input.constructorPosition) / 11) * 40

  // Recent wins (up to 20 pts)
  score += Math.min(5, input.recentWins) * 4

  // Driver marketability (up to 20 pts)
  score += (input.driverMarketabilityAvg / 100) * 20

  // Media events (up to 20 pts net)
  score += Math.min(10, input.mediaPositiveEvents) * 2
  score -= Math.min(10, input.mediaNegativeEvents) * 2

  return Math.max(0, Math.min(100, Math.round(score)))
}

/**
 * Convert prestige score to letter rating.
 */
export function scoreToRating(score: number): PrestigeRating {
  if (score >= 90) return 'A+'
  if (score >= 80) return 'A'
  if (score >= 70) return 'B+'
  if (score >= 60) return 'B'
  if (score >= 50) return 'C+'
  if (score >= 40) return 'C'
  if (score >= 25) return 'D'
  return 'F'
}
