import { describe, it, expect } from 'vitest'
import { updateMood, type MoodEvent } from '@/engine/drivers/mood-system'
import type { Mood } from '@/types/driver'

const baseMood: Mood = { motivation: 70, frustration: 20, confidence: 75 }

describe('mood system', () => {
  it('race wins increase confidence and motivation', () => {
    const updated = updateMood(baseMood, [{ type: 'race-win' }])
    expect(updated.confidence).toBeGreaterThan(baseMood.confidence)
    expect(updated.motivation).toBeGreaterThan(baseMood.motivation)
  })

  it('DNFs increase frustration', () => {
    const updated = updateMood(baseMood, [{ type: 'dnf' }])
    expect(updated.frustration).toBeGreaterThan(baseMood.frustration)
  })

  it('team orders increase frustration', () => {
    const updated = updateMood(baseMood, [{ type: 'team-order' }])
    expect(updated.frustration).toBeGreaterThan(baseMood.frustration)
  })

  it('low car competitiveness drains motivation', () => {
    const updated = updateMood(baseMood, [{ type: 'car-uncompetitive' }])
    expect(updated.motivation).toBeLessThan(baseMood.motivation)
  })

  it('mood values clamp between 0 and 100', () => {
    const extremeHigh: Mood = { motivation: 98, frustration: 98, confidence: 98 }
    const boosted = updateMood(extremeHigh, [
      { type: 'race-win' }, { type: 'race-win' }, { type: 'race-win' },
    ])
    expect(boosted.motivation).toBeLessThanOrEqual(100)
    expect(boosted.confidence).toBeLessThanOrEqual(100)

    const extremeLow: Mood = { motivation: 2, frustration: 2, confidence: 2 }
    const crushed = updateMood(extremeLow, [
      { type: 'dnf' }, { type: 'dnf' }, { type: 'dnf' },
    ])
    expect(crushed.motivation).toBeGreaterThanOrEqual(0)
    expect(crushed.confidence).toBeGreaterThanOrEqual(0)
    expect(crushed.frustration).toBeGreaterThanOrEqual(0)
  })
})
