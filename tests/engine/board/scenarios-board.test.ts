import { describe, it, expect } from 'vitest'
import { SCENARIOS } from '@/data/scenarios'

describe('scenario board expectations', () => {
  it('every scenario carries a board expectation modifier', () => {
    for (const s of SCENARIOS) {
      expect(s.boardExpectation).toBeDefined()
      expect(Number.isFinite(s.boardExpectation.positionDelta)).toBe(true)
      expect(s.boardExpectation.pointsFactor).toBeGreaterThan(0)
      expect(s.boardExpectation.toneLabel.length).toBeGreaterThan(0)
    }
  })
  it('golden-era is stricter than crisis', () => {
    const g = SCENARIOS.find(s => s.id === 'golden-era')!.boardExpectation
    const c = SCENARIOS.find(s => s.id === 'crisis')!.boardExpectation
    expect(g.positionDelta).toBeLessThan(c.positionDelta)   // negative = expect better
  })
})
