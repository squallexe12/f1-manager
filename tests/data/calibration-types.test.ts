import { describe, it, expect } from 'vitest'
import type { TireCompound, WeatherState } from '@/types/race'
import type {
  TireCalibration,
  WeatherCalibration,
  OvertakeCalibration,
  CalibrationProfile,
  CalibrationSource,
} from '@/types/calibration'
import {
  DEFAULT_TIRE_CALIBRATION,
  DEFAULT_WEATHER_CALIBRATION,
  DEFAULT_OVERTAKE_CALIBRATION,
  createFallbackProfile,
} from '@/types/calibration'

// ---------------------------------------------------------------------------
// Contract: CalibrationSource must be a discriminator for data provenance
// ---------------------------------------------------------------------------
describe('CalibrationSource', () => {
  it('accepts all three valid source values', () => {
    const sources: CalibrationSource[] = ['openf1', 'curated', 'fallback']
    expect(sources).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// Contract: TireCalibration provides per-compound degradation and grip data
// ---------------------------------------------------------------------------
describe('TireCalibration', () => {
  it('has degradation rates for all 5 compounds', () => {
    const cal: TireCalibration = DEFAULT_TIRE_CALIBRATION
    const compounds: TireCompound[] = ['C1', 'C2', 'C3', 'C4', 'C5']
    for (const c of compounds) {
      expect(cal.degradationRates[c]).toBeTypeOf('number')
      expect(cal.degradationRates[c]).toBeGreaterThan(0)
    }
  })

  it('has grip levels for all 5 compounds', () => {
    const cal: TireCalibration = DEFAULT_TIRE_CALIBRATION
    const compounds: TireCompound[] = ['C1', 'C2', 'C3', 'C4', 'C5']
    for (const c of compounds) {
      expect(cal.gripLevels[c]).toBeTypeOf('number')
      expect(cal.gripLevels[c]).toBeGreaterThan(0)
      expect(cal.gripLevels[c]).toBeLessThanOrEqual(1)
    }
  })

  it('has a base track temperature', () => {
    const cal: TireCalibration = DEFAULT_TIRE_CALIBRATION
    expect(cal.baseTrackTemp).toBeTypeOf('number')
    expect(cal.baseTrackTemp).toBeGreaterThan(0)
  })

  it('has a tire wear multiplier', () => {
    const cal: TireCalibration = DEFAULT_TIRE_CALIBRATION
    expect(cal.wearMultiplier).toBeTypeOf('number')
    expect(cal.wearMultiplier).toBeGreaterThan(0)
  })

  it('softer compounds degrade faster in defaults', () => {
    const cal: TireCalibration = DEFAULT_TIRE_CALIBRATION
    expect(cal.degradationRates['C5']).toBeGreaterThan(cal.degradationRates['C1'])
    expect(cal.degradationRates['C4']).toBeGreaterThan(cal.degradationRates['C2'])
  })

  it('softer compounds have more grip in defaults', () => {
    const cal: TireCalibration = DEFAULT_TIRE_CALIBRATION
    expect(cal.gripLevels['C5']).toBeGreaterThan(cal.gripLevels['C1'])
    expect(cal.gripLevels['C4']).toBeGreaterThan(cal.gripLevels['C2'])
  })
})

// ---------------------------------------------------------------------------
// Contract: WeatherCalibration provides circuit-specific weather behavior
// ---------------------------------------------------------------------------
describe('WeatherCalibration', () => {
  it('has transition probabilities for all weather states', () => {
    const cal: WeatherCalibration = DEFAULT_WEATHER_CALIBRATION
    const states: WeatherState[] = ['dry', 'damp', 'wet']
    for (const s of states) {
      expect(cal.transitionProbabilities[s]).toBeTypeOf('number')
      expect(cal.transitionProbabilities[s]).toBeGreaterThanOrEqual(0)
      expect(cal.transitionProbabilities[s]).toBeLessThanOrEqual(1)
    }
  })

  it('has a base rain probability between 0 and 1', () => {
    const cal: WeatherCalibration = DEFAULT_WEATHER_CALIBRATION
    expect(cal.baseRainProbability).toBeGreaterThanOrEqual(0)
    expect(cal.baseRainProbability).toBeLessThanOrEqual(1)
  })

  it('has a temperature range with min <= max', () => {
    const cal: WeatherCalibration = DEFAULT_WEATHER_CALIBRATION
    expect(cal.temperatureRange.min).toBeTypeOf('number')
    expect(cal.temperatureRange.max).toBeTypeOf('number')
    expect(cal.temperatureRange.min).toBeLessThanOrEqual(cal.temperatureRange.max)
  })
})

// ---------------------------------------------------------------------------
// Contract: OvertakeCalibration provides circuit-specific overtake behavior
// ---------------------------------------------------------------------------
describe('OvertakeCalibration', () => {
  it('has an overtake modifier greater than 0', () => {
    const cal: OvertakeCalibration = DEFAULT_OVERTAKE_CALIBRATION
    expect(cal.overtakeModifier).toBeTypeOf('number')
    expect(cal.overtakeModifier).toBeGreaterThan(0)
  })

  it('has a DRS effectiveness between 0 and 1', () => {
    const cal: OvertakeCalibration = DEFAULT_OVERTAKE_CALIBRATION
    expect(cal.drsEffectiveness).toBeTypeOf('number')
    expect(cal.drsEffectiveness).toBeGreaterThanOrEqual(0)
    expect(cal.drsEffectiveness).toBeLessThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// Contract: CalibrationProfile combines all three + metadata
// ---------------------------------------------------------------------------
describe('CalibrationProfile', () => {
  it('has circuitId, source, and all three calibration sections', () => {
    const profile: CalibrationProfile = createFallbackProfile('monza')
    expect(profile.circuitId).toBe('monza')
    expect(profile.source).toBe('fallback')
    expect(profile.tires).toBeDefined()
    expect(profile.weather).toBeDefined()
    expect(profile.overtake).toBeDefined()
  })

  it('is JSON-serializable (no class instances, no Date, no Map)', () => {
    const profile = createFallbackProfile('silverstone')
    const json = JSON.stringify(profile)
    const parsed = JSON.parse(json) as CalibrationProfile
    expect(parsed.circuitId).toBe('silverstone')
    expect(parsed.source).toBe('fallback')
    expect(parsed.tires.degradationRates['C3']).toBe(profile.tires.degradationRates['C3'])
    expect(parsed.weather.baseRainProbability).toBe(profile.weather.baseRainProbability)
    expect(parsed.overtake.overtakeModifier).toBe(profile.overtake.overtakeModifier)
  })

  it('createFallbackProfile produces valid profiles for any circuit ID', () => {
    const ids = ['melbourne', 'monaco', 'spa', 'monza', 'singapore']
    for (const id of ids) {
      const profile = createFallbackProfile(id)
      expect(profile.circuitId).toBe(id)
      expect(profile.source).toBe('fallback')
      // All tire compounds present
      for (const c of ['C1', 'C2', 'C3', 'C4', 'C5'] as TireCompound[]) {
        expect(profile.tires.degradationRates[c]).toBeGreaterThan(0)
        expect(profile.tires.gripLevels[c]).toBeGreaterThan(0)
      }
    }
  })
})
