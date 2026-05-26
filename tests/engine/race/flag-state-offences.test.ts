import { describe, it, expect } from 'vitest'
import { createPRNG } from '@/engine/core/prng'
import {
  evaluateFlagStateBreach,
  offenceTypeForFlag,
  DEFAULT_FLAG_OFFENCE_CONFIG,
} from '@/engine/race/flag-state-offences'

const input = (over: Partial<Parameters<typeof evaluateFlagStateBreach>[0]> = {}) => ({
  driverId: 'drv-a',
  flag: 'sc' as 'yellow' | 'vsc' | 'sc' | 'red',
  aggressive: true,
  experience: 70,
  mentality: 70,
  config: DEFAULT_FLAG_OFFENCE_CONFIG,
  ...over,
})

describe('offenceTypeForFlag', () => {
  it('maps each caution flag to its offence type', () => {
    expect(offenceTypeForFlag('yellow')).toBe('yellow-flag-breach')
    expect(offenceTypeForFlag('sc')).toBe('sc-infraction')
    expect(offenceTypeForFlag('vsc')).toBe('vsc-infraction')
    expect(offenceTypeForFlag('red')).toBe('red-flag-breach')
  })
})

describe('evaluateFlagStateBreach', () => {
  it('a non-aggressive driver never breaches and draws zero PRNG', () => {
    const rng = createPRNG(50)
    const peek = createPRNG(50)
    const r = evaluateFlagStateBreach(input({ aggressive: false }), rng)
    expect(r.decision).toBeNull()
    expect(rng.next()).toBe(peek.next()) // no draw consumed
  })

  it('is deterministic for a seed', () => {
    expect(evaluateFlagStateBreach(input(), createPRNG(9))).toEqual(
      evaluateFlagStateBreach(input(), createPRNG(9)),
    )
  })

  it('an inexperienced, low-mentality aggressive driver under SC can breach', () => {
    let fired = null as ReturnType<typeof evaluateFlagStateBreach> | null
    for (let s = 1; s <= 300 && !fired?.decision; s++) {
      fired = evaluateFlagStateBreach(input({ experience: 25, mentality: 25 }), createPRNG(s))
    }
    expect(fired?.decision).not.toBeNull()
    expect(fired?.decision?.offenceType).toBe('sc-infraction')
  })

  it('a disciplined veteran almost never breaches', () => {
    let fires = 0
    for (let s = 1; s <= 3000; s++) {
      if (evaluateFlagStateBreach(input({ experience: 95, mentality: 95 }), createPRNG(s)).decision) fires++
    }
    expect(fires).toBeLessThan(60) // < ~2%
  })

  // LOW review fix: assert automatic flag matches the spec (VSC=automatic, others=judgment).
  it('VSC breach is automatic: true; SC breach is automatic: false', () => {
    // Find a VSC-firing seed for an inexperienced aggressive driver.
    let vscResult: ReturnType<typeof evaluateFlagStateBreach> | null = null
    for (let s = 1; s <= 500 && !(vscResult?.decision); s++) {
      vscResult = evaluateFlagStateBreach(
        input({ flag: 'vsc', experience: 25, mentality: 25 }),
        createPRNG(s),
      )
    }
    expect(vscResult?.decision, 'expected a VSC breach within 500 seeds').not.toBeNull()
    expect(vscResult?.automatic, 'VSC breach must be automatic').toBe(true)
    expect(vscResult?.decision?.offenceType).toBe('vsc-infraction')

    // Find an SC-firing seed for the same driver profile.
    let scResult: ReturnType<typeof evaluateFlagStateBreach> | null = null
    for (let s = 1; s <= 500 && !(scResult?.decision); s++) {
      scResult = evaluateFlagStateBreach(
        input({ flag: 'sc', experience: 25, mentality: 25 }),
        createPRNG(s),
      )
    }
    expect(scResult?.decision, 'expected an SC breach within 500 seeds').not.toBeNull()
    expect(scResult?.automatic, 'SC breach must NOT be automatic (opens an investigation)').toBe(false)
    expect(scResult?.decision?.offenceType).toBe('sc-infraction')
  })
})
