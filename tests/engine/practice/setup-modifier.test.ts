import { describe, it, expect } from 'vitest'
import {
  computeSetupModifier,
  computeQualifyingModifier,
  computeRacePaceModifier,
} from '@/engine/practice/setup-modifier'

/**
 * Setup confidence → lap-time modifier (seconds). 50 is neutral (0s); higher
 * confidence is faster (negative); lower is slower (positive). The confidence-
 * 100-vs-0 TOTAL swing is 1.5s (±0.75 about neutral) — the M8-gated [0.5,2.0]
 * band. The race effect is half the qualifying effect. (Plan §M1, balance M8.)
 */
describe('computeSetupModifier', () => {
  it('maps neutral confidence 50 to 0 seconds', () => {
    expect(computeSetupModifier(50)).toBe(0)
  })

  it('maps full confidence 100 to -0.75s (faster)', () => {
    expect(computeSetupModifier(100)).toBeCloseTo(-0.75, 10)
  })

  it('maps zero confidence to +0.75s (slower)', () => {
    expect(computeSetupModifier(0)).toBeCloseTo(0.75, 10)
  })

  it('the confidence-100-vs-0 total swing is 1.5s (the M8-gated balance lever)', () => {
    expect(computeSetupModifier(0) - computeSetupModifier(100)).toBeCloseTo(1.5, 10)
  })

  it('is monotonically decreasing in confidence', () => {
    const samples = [0, 25, 50, 75, 100].map(computeSetupModifier)
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeLessThan(samples[i - 1])
    }
  })

  it('qualifying modifier equals the full setup modifier', () => {
    for (const c of [0, 33, 50, 71, 100]) {
      expect(computeQualifyingModifier(c)).toBe(computeSetupModifier(c))
    }
  })

  it('race-pace modifier is exactly half the full effect', () => {
    expect(computeRacePaceModifier(100)).toBeCloseTo(-0.375, 10)
    expect(computeRacePaceModifier(0)).toBeCloseTo(0.375, 10)
    expect(computeRacePaceModifier(50)).toBe(0)
  })
})
