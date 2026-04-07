import { describe, it, expect } from 'vitest'
import { calculateStrategyOptions } from '@/engine/race/pit-strategy'

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
