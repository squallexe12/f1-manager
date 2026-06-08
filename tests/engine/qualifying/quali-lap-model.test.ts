import { describe, it, expect } from 'vitest'
import {
  calculateQualiLapTime,
  resolveTireLabel,
  selectAICompound,
  LOW_FUEL_BONUS,
  COMPOUND_QUALI_BONUS,
} from '@/engine/qualifying/quali-lap-model'
import { createPRNG } from '@/engine/core/prng'
import type { CarPerformance } from '@/types/team'
import type { DriverAttributes } from '@/types/driver'
import type { TireCompound } from '@/types/race'

const CAR: CarPerformance = {
  downforce: 80, straightSpeed: 80, reliability: 80,
  tireManagement: 80, braking: 80, cornering: 80,
}
const ATTR: DriverAttributes = {
  pace: 85, racecraft: 80, experience: 60, mentality: 70,
  marketability: 60, developmentPotential: 60,
}
const COMPOUNDS: readonly TireCompound[] = ['C3', 'C4', 'C5'] // hardest, medium, softest

function lap(over: Partial<Parameters<typeof calculateQualiLapTime>[0]> = {}, seed = 42) {
  return calculateQualiLapTime({
    car: CAR, attributes: ATTR, compound: 'C5', tireLabel: 'soft',
    setupConfidence: 50, weather: 'dry', prng: createPRNG(seed), ...over,
  })
}

describe('calculateQualiLapTime', () => {
  it('consumes exactly ONE PRNG draw', () => {
    const prng = createPRNG(7)
    let calls = 0
    const counting = { ...prng, next: () => { calls++; return prng.next() } }
    calculateQualiLapTime({
      car: CAR, attributes: ATTR, compound: 'C5', tireLabel: 'soft',
      setupConfidence: 50, weather: 'dry', prng: counting,
    })
    expect(calls).toBe(1)
  })

  it('soft is faster than hard by ~the compound-bonus spread (same seed)', () => {
    const soft = lap({ tireLabel: 'soft' }).lapTime
    const hard = lap({ tireLabel: 'hard' }).lapTime
    expect(soft).toBeLessThan(hard)
    expect(hard - soft).toBeCloseTo(COMPOUND_QUALI_BONUS.soft - COMPOUND_QUALI_BONUS.hard, 6)
  })

  it('higher setup confidence is faster; the 100-vs-0 delta is ~1.5s (same seed)', () => {
    const c100 = lap({ setupConfidence: 100 }).lapTime
    const c0 = lap({ setupConfidence: 0 }).lapTime
    expect(c100).toBeLessThan(c0)
    expect(c0 - c100).toBeCloseTo(1.5, 6)
    expect(c0 - c100).toBeLessThanOrEqual(1.5 + 1e-9) // M2 acceptance: delta <= 1.5s
  })

  it('a better car is faster (same seed)', () => {
    const good = lap({ car: { ...CAR, downforce: 95, straightSpeed: 95, braking: 95, cornering: 95 } }).lapTime
    const bad = lap({ car: { ...CAR, downforce: 40, straightSpeed: 40, braking: 40, cornering: 40 } }).lapTime
    expect(good).toBeLessThan(bad)
  })

  it('wet conditions add ~8s vs dry (same seed)', () => {
    const dry = lap({ weather: 'dry' }).lapTime
    const wet = lap({ weather: 'wet' }).lapTime
    expect(wet - dry).toBeCloseTo(8, 6)
  })

  it('runs lighter than a race lap (low-fuel bonus is applied)', () => {
    // A neutral 50-confidence soft lap should be faster than the bare car+driver
    // band by at least the low-fuel + soft-compound bonus.
    const t = lap({ setupConfidence: 50, weather: 'dry' }).lapTime
    expect(t).toBeLessThan(95) // 95 = mid-car carTime ceiling; low-fuel+soft pull it well under
    expect(LOW_FUEL_BONUS).toBeGreaterThan(0)
  })

  it('experience tightens variance (more experienced = smaller variance)', () => {
    const rookie = lap({ attributes: { ...ATTR, experience: 0 } }).variance
    const veteran = lap({ attributes: { ...ATTR, experience: 100 } }).variance
    expect(veteran).toBeLessThan(rookie)
  })
})

describe('resolveTireLabel', () => {
  it('maps compound position to label (hardest/medium/softest)', () => {
    expect(resolveTireLabel('C3', COMPOUNDS)).toBe('hard')
    expect(resolveTireLabel('C4', COMPOUNDS)).toBe('medium')
    expect(resolveTireLabel('C5', COMPOUNDS)).toBe('soft')
  })
  it('falls back to medium for a compound not in the circuit set', () => {
    expect(resolveTireLabel('C1', COMPOUNDS)).toBe('medium')
  })
})

describe('selectAICompound', () => {
  it('uses the softest compound in the final segment', () => {
    expect(selectAICompound(COMPOUNDS, true)).toBe('C5')
  })
  it('uses the medium compound in non-final segments', () => {
    expect(selectAICompound(COMPOUNDS, false)).toBe('C4')
  })
})
