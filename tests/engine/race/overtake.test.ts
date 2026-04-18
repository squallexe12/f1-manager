import { describe, it, expect } from 'vitest'
import { calculateOvertakeProbability } from '@/engine/race/overtake'
import { DEFAULT_OVERTAKE_CALIBRATION, type OvertakeCalibration } from '@/types/calibration'

function makeCalibration(overrides: Partial<OvertakeCalibration> = {}): OvertakeCalibration {
  return { ...DEFAULT_OVERTAKE_CALIBRATION, ...overrides }
}

describe('overtake model', () => {
  it('higher car performance delta increases overtake probability', () => {
    const cal = makeCalibration()
    const highDelta = calculateOvertakeProbability({ performanceDelta: 0.8, racecraft: 80, calibration: cal, tireDelta: 0 })
    const lowDelta = calculateOvertakeProbability({ performanceDelta: 0.2, racecraft: 80, calibration: cal, tireDelta: 0 })
    expect(highDelta.probability).toBeGreaterThan(lowDelta.probability)
  })

  it('higher overtakeModifier increases probability (easier circuits)', () => {
    const easy = makeCalibration({ overtakeModifier: 1.3 })
    const hard = makeCalibration({ overtakeModifier: 0.5 })
    const easyResult = calculateOvertakeProbability({ performanceDelta: 0.5, racecraft: 80, calibration: easy, tireDelta: 0 })
    const hardResult = calculateOvertakeProbability({ performanceDelta: 0.5, racecraft: 80, calibration: hard, tireDelta: 0 })
    expect(easyResult.probability).toBeGreaterThan(hardResult.probability)
  })

  it('returns probability between 0 and 1', () => {
    const cal = makeCalibration()
    const result = calculateOvertakeProbability({ performanceDelta: 0.5, racecraft: 80, calibration: cal, tireDelta: 10 })
    expect(result.probability).toBeGreaterThanOrEqual(0)
    expect(result.probability).toBeLessThanOrEqual(1)
  })
})
