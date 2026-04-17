import { describe, it, expect } from 'vitest'
import {
  normalizeWeatherCalibration,
  normalizeTireCalibration,
  normalizeOvertakeCalibration,
  normalizeCalibrationProfile,
  mapOpenF1CompoundToPirelli,
} from '@scripts/openf1/normalize'
import {
  DEFAULT_TIRE_CALIBRATION,
  DEFAULT_WEATHER_CALIBRATION,
  DEFAULT_OVERTAKE_CALIBRATION,
} from '@/types/calibration'
import type {
  OpenF1Lap,
  OpenF1Stint,
  OpenF1Weather,
  OpenF1SessionBundle,
} from '@scripts/openf1/types'

// ---------------------------------------------------------------------------
// Compound mapping — OpenF1 SOFT/MEDIUM/HARD → Pirelli C1–C5 given circuit pick
// ---------------------------------------------------------------------------

describe('mapOpenF1CompoundToPirelli', () => {
  it('maps SOFT to the softest compound in the circuit pick', () => {
    expect(mapOpenF1CompoundToPirelli('SOFT', ['C1', 'C2', 'C3'])).toBe('C3')
    expect(mapOpenF1CompoundToPirelli('SOFT', ['C3', 'C4', 'C5'])).toBe('C5')
  })

  it('maps MEDIUM to the middle compound in the circuit pick', () => {
    expect(mapOpenF1CompoundToPirelli('MEDIUM', ['C1', 'C2', 'C3'])).toBe('C2')
    expect(mapOpenF1CompoundToPirelli('MEDIUM', ['C2', 'C3', 'C4'])).toBe('C3')
  })

  it('maps HARD to the hardest compound in the circuit pick', () => {
    expect(mapOpenF1CompoundToPirelli('HARD', ['C1', 'C2', 'C3'])).toBe('C1')
    expect(mapOpenF1CompoundToPirelli('HARD', ['C2', 'C3', 'C4'])).toBe('C2')
  })

  it('returns null for intermediate and wet compounds', () => {
    expect(mapOpenF1CompoundToPirelli('INTERMEDIATE', ['C1', 'C2', 'C3'])).toBeNull()
    expect(mapOpenF1CompoundToPirelli('WET', ['C1', 'C2', 'C3'])).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Weather normalizer
// ---------------------------------------------------------------------------

describe('normalizeWeatherCalibration', () => {
  it('returns defaults when weather samples are empty', () => {
    expect(normalizeWeatherCalibration([])).toEqual(DEFAULT_WEATHER_CALIBRATION)
  })

  it('computes temperatureRange from min/max air temperature samples', () => {
    const weather: OpenF1Weather[] = [
      { date: '2024-01-01T13:00:00Z', air_temperature: 22, track_temperature: 35, rainfall: 0, humidity: 40 },
      { date: '2024-01-01T13:10:00Z', air_temperature: 28, track_temperature: 42, rainfall: 0, humidity: 40 },
      { date: '2024-01-01T13:20:00Z', air_temperature: 25, track_temperature: 38, rainfall: 0, humidity: 40 },
    ]
    const result = normalizeWeatherCalibration(weather)
    expect(result.temperatureRange).toEqual({ min: 22, max: 28 })
  })

  it('computes baseRainProbability as proportion of samples with rainfall > 0', () => {
    const weather: OpenF1Weather[] = [
      { date: '2024-01-01T13:00:00Z', air_temperature: 22, track_temperature: 35, rainfall: 0, humidity: 40 },
      { date: '2024-01-01T13:10:00Z', air_temperature: 22, track_temperature: 35, rainfall: 1, humidity: 85 },
      { date: '2024-01-01T13:20:00Z', air_temperature: 22, track_temperature: 35, rainfall: 2, humidity: 90 },
      { date: '2024-01-01T13:30:00Z', air_temperature: 22, track_temperature: 35, rainfall: 0, humidity: 60 },
    ]
    const result = normalizeWeatherCalibration(weather)
    expect(result.baseRainProbability).toBeCloseTo(0.5, 2)
  })

  it('clamps baseRainProbability between 0 and 1', () => {
    const allDry: OpenF1Weather[] = Array.from({ length: 10 }, (_, i) => ({
      date: `2024-01-01T13:0${i}:00Z`,
      air_temperature: 25,
      track_temperature: 38,
      rainfall: 0,
      humidity: 40,
    }))
    expect(normalizeWeatherCalibration(allDry).baseRainProbability).toBe(0)

    const allWet: OpenF1Weather[] = Array.from({ length: 10 }, (_, i) => ({
      date: `2024-01-01T13:0${i}:00Z`,
      air_temperature: 18,
      track_temperature: 25,
      rainfall: 2,
      humidity: 95,
    }))
    expect(normalizeWeatherCalibration(allWet).baseRainProbability).toBe(1)
  })

  it('returns transitionProbabilities keyed by all weather states', () => {
    const weather: OpenF1Weather[] = [
      { date: '2024-01-01T13:00:00Z', air_temperature: 25, track_temperature: 38, rainfall: 0, humidity: 40 },
    ]
    const result = normalizeWeatherCalibration(weather)
    expect(result.transitionProbabilities).toHaveProperty('dry')
    expect(result.transitionProbabilities).toHaveProperty('damp')
    expect(result.transitionProbabilities).toHaveProperty('wet')
  })
})

// ---------------------------------------------------------------------------
// Tire normalizer
// ---------------------------------------------------------------------------

describe('normalizeTireCalibration', () => {
  it('returns defaults when no stints are provided', () => {
    expect(normalizeTireCalibration([], [], ['C1', 'C2', 'C3'])).toEqual(DEFAULT_TIRE_CALIBRATION)
  })

  it('returns defaults when stints exist but no matching laps', () => {
    const stints: OpenF1Stint[] = [
      { driver_number: 1, stint_number: 1, lap_start: 1, lap_end: 10, compound: 'SOFT', tyre_age_at_start: 0 },
    ]
    const result = normalizeTireCalibration([], stints, ['C1', 'C2', 'C3'])
    expect(result).toEqual(DEFAULT_TIRE_CALIBRATION)
  })

  it('computes degradation rate from lap-time delta over stint age', () => {
    // Soft compound, lap time increases ~0.3s per lap → degradation signal
    const stints: OpenF1Stint[] = [
      { driver_number: 1, stint_number: 1, lap_start: 1, lap_end: 5, compound: 'SOFT', tyre_age_at_start: 0 },
    ]
    const laps: OpenF1Lap[] = [
      { driver_number: 1, lap_number: 1, lap_duration: 80.0 },
      { driver_number: 1, lap_number: 2, lap_duration: 80.3 },
      { driver_number: 1, lap_number: 3, lap_duration: 80.6 },
      { driver_number: 1, lap_number: 4, lap_duration: 80.9 },
      { driver_number: 1, lap_number: 5, lap_duration: 81.2 },
    ]
    const result = normalizeTireCalibration(laps, stints, ['C1', 'C2', 'C3'])
    // Soft → C3 in this pick; degradation should be > default 1.5 since lap-time slope is present
    expect(result.degradationRates.C3).toBeGreaterThan(0)
    // Compounds not observed retain default values
    expect(result.degradationRates.C1).toBe(DEFAULT_TIRE_CALIBRATION.degradationRates.C1)
  })

  it('ignores laps with null or invalid lap_duration', () => {
    const stints: OpenF1Stint[] = [
      { driver_number: 1, stint_number: 1, lap_start: 1, lap_end: 3, compound: 'SOFT', tyre_age_at_start: 0 },
    ]
    const laps: OpenF1Lap[] = [
      { driver_number: 1, lap_number: 1, lap_duration: null },
      { driver_number: 1, lap_number: 2, lap_duration: null },
      { driver_number: 1, lap_number: 3, lap_duration: null },
    ]
    const result = normalizeTireCalibration(laps, stints, ['C1', 'C2', 'C3'])
    expect(result.degradationRates.C3).toBe(DEFAULT_TIRE_CALIBRATION.degradationRates.C3)
  })

  it('preserves JSON-serializable output (no NaN, no Infinity)', () => {
    const stints: OpenF1Stint[] = [
      { driver_number: 1, stint_number: 1, lap_start: 1, lap_end: 1, compound: 'SOFT', tyre_age_at_start: 0 },
    ]
    const laps: OpenF1Lap[] = [
      { driver_number: 1, lap_number: 1, lap_duration: 80.0 },
    ]
    const result = normalizeTireCalibration(laps, stints, ['C1', 'C2', 'C3'])
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('null')
    expect(serialized).not.toContain('NaN')
    expect(() => JSON.parse(serialized)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Overtake normalizer
// ---------------------------------------------------------------------------

describe('normalizeOvertakeCalibration', () => {
  it('returns defaults when no lap data is provided', () => {
    expect(normalizeOvertakeCalibration([])).toEqual(DEFAULT_OVERTAKE_CALIBRATION)
  })

  it('returns values within valid calibration ranges', () => {
    const laps: OpenF1Lap[] = [
      { driver_number: 1, lap_number: 1, lap_duration: 80.0 },
      { driver_number: 2, lap_number: 1, lap_duration: 80.2 },
    ]
    const result = normalizeOvertakeCalibration(laps)
    expect(result.overtakeModifier).toBeGreaterThan(0)
    expect(result.drsEffectiveness).toBeGreaterThanOrEqual(0)
    expect(result.drsEffectiveness).toBeLessThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// End-to-end profile normalizer
// ---------------------------------------------------------------------------

describe('normalizeCalibrationProfile', () => {
  const bundle: OpenF1SessionBundle = {
    circuitId: 'bahrain',
    circuitCompounds: ['C1', 'C2', 'C3'],
    sessionKey: 9999,
    laps: [
      { driver_number: 1, lap_number: 1, lap_duration: 92.0 },
      { driver_number: 1, lap_number: 2, lap_duration: 92.4 },
    ],
    stints: [
      { driver_number: 1, stint_number: 1, lap_start: 1, lap_end: 2, compound: 'SOFT', tyre_age_at_start: 0 },
    ],
    weather: [
      { date: '2024-03-02T15:00:00Z', air_temperature: 25, track_temperature: 38, rainfall: 0, humidity: 45 },
    ],
  }

  it('stamps the profile with source "openf1"', () => {
    const profile = normalizeCalibrationProfile(bundle)
    expect(profile.source).toBe('openf1')
  })

  it('uses the provided circuitId', () => {
    const profile = normalizeCalibrationProfile(bundle)
    expect(profile.circuitId).toBe('bahrain')
  })

  it('returns a fully-formed CalibrationProfile with all three sub-calibrations', () => {
    const profile = normalizeCalibrationProfile(bundle)
    expect(profile.tires).toBeDefined()
    expect(profile.weather).toBeDefined()
    expect(profile.overtake).toBeDefined()
  })

  it('produces JSON-round-trip-safe output', () => {
    const profile = normalizeCalibrationProfile(bundle)
    const roundtripped = JSON.parse(JSON.stringify(profile))
    expect(roundtripped).toEqual(profile)
  })
})
