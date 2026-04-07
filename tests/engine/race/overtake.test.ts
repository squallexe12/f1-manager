import { describe, it, expect } from 'vitest'
import { calculateOvertakeProbability } from '@/engine/race/overtake'

describe('overtake model', () => {
  it('higher car performance delta increases overtake probability', () => {
    const highDelta = calculateOvertakeProbability({ performanceDelta: 0.8, racecraft: 80, circuitDifficulty: 'medium', tireDelta: 0 })
    const lowDelta = calculateOvertakeProbability({ performanceDelta: 0.2, racecraft: 80, circuitDifficulty: 'medium', tireDelta: 0 })
    expect(highDelta.probability).toBeGreaterThan(lowDelta.probability)
  })

  it('high overtaking difficulty circuits reduce probability', () => {
    const easy = calculateOvertakeProbability({ performanceDelta: 0.5, racecraft: 80, circuitDifficulty: 'low', tireDelta: 0 })
    const hard = calculateOvertakeProbability({ performanceDelta: 0.5, racecraft: 80, circuitDifficulty: 'high', tireDelta: 0 })
    expect(easy.probability).toBeGreaterThan(hard.probability)
  })

  it('returns probability between 0 and 1', () => {
    const result = calculateOvertakeProbability({ performanceDelta: 0.5, racecraft: 80, circuitDifficulty: 'medium', tireDelta: 10 })
    expect(result.probability).toBeGreaterThanOrEqual(0)
    expect(result.probability).toBeLessThanOrEqual(1)
  })
})
