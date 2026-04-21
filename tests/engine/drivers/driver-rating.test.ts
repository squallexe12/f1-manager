import { describe, it, expect } from 'vitest'
import { calculateOverallRating } from '@/engine/drivers/driver-rating'

describe('calculateOverallRating', () => {
  it('returns a rating in the 0-100 range', () => {
    const r = calculateOverallRating({
      pace: 85, racecraft: 80, experience: 70, mentality: 75,
      marketability: 60, developmentPotential: 50,
    })
    expect(r).toBeGreaterThanOrEqual(0)
    expect(r).toBeLessThanOrEqual(100)
  })

  it('weights pace and racecraft heavier than marketability', () => {
    const highPace = calculateOverallRating({
      pace: 99, racecraft: 99, experience: 50, mentality: 50,
      marketability: 0, developmentPotential: 50,
    })
    const highMarketing = calculateOverallRating({
      pace: 50, racecraft: 50, experience: 50, mentality: 50,
      marketability: 99, developmentPotential: 50,
    })
    expect(highPace).toBeGreaterThan(highMarketing)
  })

  it('rounds to an integer', () => {
    const r = calculateOverallRating({
      pace: 83, racecraft: 81, experience: 77, mentality: 79,
      marketability: 71, developmentPotential: 69,
    })
    expect(Number.isInteger(r)).toBe(true)
  })

  it('is pure — same inputs always produce same output', () => {
    const a = { pace: 80, racecraft: 80, experience: 80, mentality: 80, marketability: 80, developmentPotential: 80 }
    expect(calculateOverallRating(a)).toBe(calculateOverallRating(a))
  })
})
