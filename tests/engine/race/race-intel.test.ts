import { describe, it, expect } from 'vitest'
import { deriveRaceIntel } from '@/engine/race/race-intel'
import { createFallbackProfile } from '@/types/calibration'
import type { Circuit } from '@/types/race'

const MONZA: Circuit = {
  id: 'monza',
  name: 'Italian Grand Prix',
  country: 'Italy',
  laps: 53,
  downforceLevel: 'low',
  tireWear: 'medium',
  overtakingDifficulty: 'low',
  weatherVariability: 'low',
  sectorCount: 3,
  compounds: ['C3', 'C4', 'C5'],
}

describe('deriveRaceIntel', () => {
  it('returns expected stint laps for each compound on the Pirelli pick', () => {
    const profile = createFallbackProfile('monza')
    const intel = deriveRaceIntel(profile, MONZA)
    expect(intel.expectedStintLaps.C3).toBeGreaterThan(0)
    expect(intel.expectedStintLaps.C4).toBeGreaterThan(0)
    expect(intel.expectedStintLaps.C5).toBeGreaterThan(0)
  })

  it('reports pit-loss range centered on the mean', () => {
    const profile = {
      ...createFallbackProfile('monza'),
      pitLoss: { meanLossSeconds: 24, stddevSeconds: 1.5, sampleCount: 30 },
    }
    const intel = deriveRaceIntel(profile, MONZA)
    expect(intel.pitLossRangeSec.mean).toBe(24)
    expect(intel.pitLossRangeSec.low).toBeCloseTo(22.5, 1)
    expect(intel.pitLossRangeSec.high).toBeCloseTo(25.5, 1)
  })

  it('describes overtake difficulty from the circuit enum when no rich profile is set', () => {
    const profile = createFallbackProfile('monza')
    const intel = deriveRaceIntel(profile, MONZA)
    expect(intel.overtakeHint).toMatch(/easy|low|straightforward/i)
  })

  it('summarizes weather outlook by base rain probability', () => {
    const dryProfile = {
      ...createFallbackProfile('monza'),
      weather: {
        ...createFallbackProfile('monza').weather,
        baseRainProbability: 0,
      },
    }
    const wetProfile = {
      ...createFallbackProfile('spa'),
      weather: {
        ...createFallbackProfile('spa').weather,
        baseRainProbability: 0.45,
      },
    }
    expect(deriveRaceIntel(dryProfile, MONZA).weatherOutlook).toMatch(/dry/i)
    expect(deriveRaceIntel(wetProfile, MONZA).weatherOutlook).toMatch(/rain|wet|volatile/i)
  })

  it('flags that intel comes from a fallback profile when source !== openf1', () => {
    const profile = createFallbackProfile('monza')
    const intel = deriveRaceIntel(profile, MONZA)
    expect(intel.dataSource).toBe('fallback')
  })

  it('flags openf1 provenance when source === openf1', () => {
    const profile = {
      ...createFallbackProfile('monza'),
      source: 'openf1' as const,
    }
    const intel = deriveRaceIntel(profile, MONZA)
    expect(intel.dataSource).toBe('openf1')
  })

  it('is a pure function (no mutation of inputs)', () => {
    const profile = createFallbackProfile('monza')
    const frozen = JSON.stringify(profile)
    deriveRaceIntel(profile, MONZA)
    expect(JSON.stringify(profile)).toBe(frozen)
  })
})
