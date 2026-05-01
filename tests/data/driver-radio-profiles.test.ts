// tests/data/driver-radio-profiles.test.ts
import { describe, it, expect } from 'vitest'
import { DRIVER_RADIO_PROFILES } from '@/data/driver-radio-profiles'
import { TEAMS } from '@/data/teams'

const ALL_DRIVER_IDS = TEAMS.flatMap(t => t.driverIds)

describe('DRIVER_RADIO_PROFILES — coverage', () => {
  it('has a profile for every driver in TEAMS', () => {
    const profileIds = new Set(DRIVER_RADIO_PROFILES.map(p => p.driverId))
    for (const id of ALL_DRIVER_IDS) {
      expect(profileIds.has(id)).toBe(true)
    }
  })

  it('every profile has a valid primary archetype', () => {
    const valid = ['calm-pro', 'hot-headed', 'spiritual', 'emotional', 'rookie', 'veteran']
    for (const p of DRIVER_RADIO_PROFILES) {
      expect(valid).toContain(p.archetypes[0])
    }
  })

  it('catchphraseChance is in [0, 1] when set', () => {
    for (const p of DRIVER_RADIO_PROFILES) {
      if (p.catchphraseChance !== undefined) {
        expect(p.catchphraseChance).toBeGreaterThanOrEqual(0)
        expect(p.catchphraseChance).toBeLessThanOrEqual(1)
      }
    }
  })
})
