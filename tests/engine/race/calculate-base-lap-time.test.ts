/**
 * M6 — setup-confidence consequence injection into the base lap-time model.
 *
 * `calculateBaseLapTime` gains an additive `setupModifier` term so a dialled-in
 * car (high setup confidence → negative modifier) is fractionally faster every
 * lap. The term is PURE arithmetic — it must add ZERO PRNG draws so the race
 * stream stays byte-identical with or without the feature (no desync).
 */
import { describe, it, expect, vi } from 'vitest'
import { calculateBaseLapTime, type RaceDriver } from '@/engine/race/race-simulator'

function makeDriver(overrides: Partial<RaceDriver> = {}): RaceDriver {
  return {
    id: 'd1',
    shortName: 'DRA',
    teamId: 'team-1',
    car: { downforce: 80, straightSpeed: 80, reliability: 90, tireManagement: 80, braking: 80, cornering: 80 },
    attributes: { pace: 80, racecraft: 80, experience: 80, mentality: 80, marketability: 70, developmentPotential: 60 },
    mood: { motivation: 50, frustration: 30, confidence: 60 },
    ...overrides,
  }
}

describe('calculateBaseLapTime — setupModifier (M6)', () => {
  it('omitting setupModifier equals passing an explicit 0 (backward compatible)', () => {
    const d = makeDriver()
    expect(calculateBaseLapTime(d, 1, 'dry')).toBe(calculateBaseLapTime(d, 1, 'dry', 0))
  })

  it('applies setupModifier as a pure additive lap-time shift', () => {
    const d = makeDriver()
    const base = calculateBaseLapTime(d, 1, 'dry', 0)
    expect(calculateBaseLapTime(d, 1, 'dry', -0.75)).toBeCloseTo(base - 0.75, 10)
    expect(calculateBaseLapTime(d, 1, 'dry', 0.75)).toBeCloseTo(base + 0.75, 10)
  })

  it('a negative modifier (higher setup confidence) yields a faster (lower) lap time', () => {
    const d = makeDriver()
    expect(calculateBaseLapTime(d, 1, 'dry', -0.5)).toBeLessThan(calculateBaseLapTime(d, 1, 'dry', 0))
  })

  it('makes no Math.random / PRNG calls — additive term is pure arithmetic', () => {
    const spy = vi.spyOn(Math, 'random')
    const d = makeDriver()
    calculateBaseLapTime(d, 0.8, 'dry', -0.3)
    calculateBaseLapTime(d, 0.8, 'wet', 0.3)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
