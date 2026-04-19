import { describe, it, expect } from 'vitest'
import { calculateStrategyOptions } from '@/engine/race/pit-strategy'
import type { PitLossCalibration, StintCalibration } from '@/types/calibration'

describe('pit strategy calculator', () => {
  it('returns 3 strategy options (undercut, optimum, overcut)', () => {
    const options = calculateStrategyOptions({ currentLap: 25, totalLaps: 55, tireWear: 55, compound: 'C3', circuitTireWear: 'medium' })
    expect(options).toHaveLength(3)
    expect(options.map(o => o.type)).toEqual(['undercut', 'optimum', 'overcut'])
  })

  it('undercut pit lap is earlier than optimum', () => {
    const options = calculateStrategyOptions({ currentLap: 25, totalLaps: 55, tireWear: 55, compound: 'C3', circuitTireWear: 'medium' })
    expect(options[0].pitLap).toBeLessThan(options[1].pitLap)
  })

  it('overcut pit lap is later than optimum', () => {
    const options = calculateStrategyOptions({ currentLap: 25, totalLaps: 55, tireWear: 55, compound: 'C3', circuitTireWear: 'medium' })
    expect(options[2].pitLap).toBeGreaterThan(options[1].pitLap)
  })
})

describe('pit strategy calibration integration (IP-07 Task 4)', () => {
  const pitLoss: PitLossCalibration = {
    meanLossSeconds: 23.8,
    stddevSeconds: 1.4,
    sampleCount: 42,
  }
  const stint: StintCalibration = {
    expectedLaps: { C1: 34, C2: 28, C3: 22, C4: 16, C5: 12 },
    sampleCount: 110,
  }

  it('populates projectedPitLossSec on each option when pitLoss is supplied', () => {
    const options = calculateStrategyOptions({
      currentLap: 10,
      totalLaps: 50,
      tireWear: 80,
      compound: 'C3',
      circuitTireWear: 'medium',
      pitLossProfile: pitLoss,
    })
    for (const opt of options) {
      expect(opt.projectedPitLossSec).toBe(23.8)
    }
  })

  it('omits projectedPitLossSec when pitLoss profile is not provided', () => {
    const options = calculateStrategyOptions({
      currentLap: 10,
      totalLaps: 50,
      tireWear: 80,
      compound: 'C3',
      circuitTireWear: 'medium',
    })
    for (const opt of options) {
      expect(opt.projectedPitLossSec).toBeUndefined()
    }
  })

  it('mentions the pit-loss cost in the projectedOutcome text when supplied', () => {
    const [undercut] = calculateStrategyOptions({
      currentLap: 10,
      totalLaps: 50,
      tireWear: 80,
      compound: 'C3',
      circuitTireWear: 'medium',
      pitLossProfile: pitLoss,
    })
    // Copy should reference the pit-loss cost for the player to reason about.
    expect(undercut.projectedOutcome).toMatch(/~?\d+(\.\d+)?s/)
  })

  it('anchors the optimum pit lap near currentLap + expectedStintRemaining when stintProfile is supplied', () => {
    // C3 expected stint = 22 laps. Player starts at lap 10 with 80% tread remaining,
    // so optimum pit target should sit near lap 10 + (22 * (80/100)) ≈ lap 28,
    // well before the heuristic would suggest without stint data.
    const options = calculateStrategyOptions({
      currentLap: 10,
      totalLaps: 50,
      tireWear: 80,
      compound: 'C3',
      circuitTireWear: 'medium',
      stintProfile: stint,
    })
    const optimum = options.find((o) => o.type === 'optimum')!
    expect(optimum.pitLap).toBeGreaterThanOrEqual(22)
    expect(optimum.pitLap).toBeLessThanOrEqual(34)
  })

  it('stays purely deterministic (no randomness)', () => {
    const input = {
      currentLap: 12,
      totalLaps: 58,
      tireWear: 65,
      compound: 'C4' as const,
      circuitTireWear: 'high' as const,
      pitLossProfile: pitLoss,
      stintProfile: stint,
    }
    const a = calculateStrategyOptions(input)
    const b = calculateStrategyOptions(input)
    expect(a).toEqual(b)
  })
})
