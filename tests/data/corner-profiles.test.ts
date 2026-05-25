import { describe, it, expect } from 'vitest'
import { CORNER_PROFILES, cornersForCircuit, DEFAULT_CORNER_PROFILE } from '@/data/corner-profiles'
import { CIRCUITS } from '@/data/circuits'

describe('corner-profiles data', () => {
  it('has an entry for every circuit id', () => {
    for (const c of CIRCUITS) {
      expect(CORNER_PROFILES[c.id], `missing corner profile for ${c.id}`).toBeDefined()
    }
  })

  it('every monitored corner has a valid lapFraction in [0,1) and a difficulty tier', () => {
    for (const profile of Object.values(CORNER_PROFILES)) {
      for (const corner of profile.corners) {
        expect(corner.lapFraction).toBeGreaterThanOrEqual(0)
        expect(corner.lapFraction).toBeLessThan(1)
        expect([1, 2, 3]).toContain(corner.difficultyTier)
        expect(['low', 'med', 'high']).toContain(corner.rejoinRisk)
      }
    }
  })

  it('cornersForCircuit falls back for an unknown circuit', () => {
    expect(cornersForCircuit('does-not-exist', DEFAULT_CORNER_PROFILE)).toBe(DEFAULT_CORNER_PROFILE)
  })

  it('returns only track-limit-monitored corners via the monitored helper', () => {
    const silverstone = cornersForCircuit('silverstone', DEFAULT_CORNER_PROFILE)
    expect(silverstone.corners.some((c) => c.trackLimitMonitored)).toBe(true)
  })
})
