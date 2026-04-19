import { describe, it, expect } from 'vitest'
import {
  clearCalibrationRegistry,
  hydrateBuiltInProfiles,
  loadCalibrationProfile,
  registerCalibrationProfile,
} from '@/data/calibration'
import {
  sanitizeTireCalibration,
  sanitizePitLossCalibration,
  sanitizeStintCalibration,
} from '@/data/calibration/sanitize'
import {
  DEFAULT_TIRE_CALIBRATION,
  DEFAULT_PITLOSS_CALIBRATION,
  DEFAULT_STINT_CALIBRATION,
  type CalibrationProfile,
} from '@/types/calibration'

describe('sanitizeTireCalibration', () => {
  it('floors every compound at the default degradation rate', () => {
    const input = {
      degradationRates: { C1: 0.1, C2: 0.1, C3: 0.1, C4: 0.1, C5: 0.1 },
      gripLevels: { C1: 0.88, C2: 0.92, C3: 0.95, C4: 0.98, C5: 1.0 },
      baseTrackTemp: 35,
      wearMultiplier: 1,
    }
    const out = sanitizeTireCalibration(input)
    expect(out.degradationRates.C1).toBe(DEFAULT_TIRE_CALIBRATION.degradationRates.C1)
    expect(out.degradationRates.C2).toBe(DEFAULT_TIRE_CALIBRATION.degradationRates.C2)
    expect(out.degradationRates.C3).toBe(DEFAULT_TIRE_CALIBRATION.degradationRates.C3)
    expect(out.degradationRates.C4).toBe(DEFAULT_TIRE_CALIBRATION.degradationRates.C4)
    expect(out.degradationRates.C5).toBe(DEFAULT_TIRE_CALIBRATION.degradationRates.C5)
  })

  it('preserves OpenF1 values that exceed the default floor', () => {
    const input = {
      degradationRates: { C1: 0.1, C2: 2.44, C3: 0.1, C4: 2.0, C5: 2.8 },
      gripLevels: { C1: 0.88, C2: 0.92, C3: 0.95, C4: 0.98, C5: 1.0 },
      baseTrackTemp: 35,
      wearMultiplier: 1,
    }
    const out = sanitizeTireCalibration(input)
    expect(out.degradationRates.C2).toBe(2.44) // preserved, above default 1.1
    expect(out.degradationRates.C5).toBe(2.8)  // preserved, equal to default
  })

  it('enforces monotonic ordering — softer compound never degrades slower than a harder one', () => {
    // Melbourne-style: C4=5 > C5=2.8 (backwards)
    const input = {
      degradationRates: { C1: 0.8, C2: 1.1, C3: 1.5, C4: 5.0, C5: 2.8 },
      gripLevels: { C1: 0.88, C2: 0.92, C3: 0.95, C4: 0.98, C5: 1.0 },
      baseTrackTemp: 35,
      wearMultiplier: 1,
    }
    const out = sanitizeTireCalibration(input)
    expect(out.degradationRates.C1).toBeLessThanOrEqual(out.degradationRates.C2)
    expect(out.degradationRates.C2).toBeLessThanOrEqual(out.degradationRates.C3)
    expect(out.degradationRates.C3).toBeLessThanOrEqual(out.degradationRates.C4)
    expect(out.degradationRates.C4).toBeLessThanOrEqual(out.degradationRates.C5)
    expect(out.degradationRates.C5).toBeGreaterThanOrEqual(5.0) // pulled up from C4
  })

  it('does not mutate the input', () => {
    const input = {
      degradationRates: { C1: 0.1, C2: 0.1, C3: 0.1, C4: 0.1, C5: 0.1 },
      gripLevels: { C1: 0.88, C2: 0.92, C3: 0.95, C4: 0.98, C5: 1.0 },
      baseTrackTemp: 35,
      wearMultiplier: 1,
    }
    const snapshot = JSON.parse(JSON.stringify(input))
    sanitizeTireCalibration(input)
    expect(input).toEqual(snapshot)
  })
})

describe('calibration registry applies sanitization on register', () => {
  it('every built-in profile has monotonic degradation and meets the default floor', () => {
    clearCalibrationRegistry()
    hydrateBuiltInProfiles()

    const circuitIds = [
      'bahrain', 'jeddah', 'melbourne', 'suzuka', 'shanghai', 'miami', 'imola',
      'monaco', 'montreal', 'barcelona', 'spielberg', 'silverstone', 'spa',
      'zandvoort', 'monza', 'baku', 'singapore', 'austin', 'mexico',
      'interlagos', 'las-vegas', 'abu-dhabi',
    ]

    for (const id of circuitIds) {
      const profile = loadCalibrationProfile(id)
      const d = profile.tires.degradationRates
      const def = DEFAULT_TIRE_CALIBRATION.degradationRates
      expect(d.C1, `${id} C1 below floor`).toBeGreaterThanOrEqual(def.C1)
      expect(d.C2, `${id} C2 below floor`).toBeGreaterThanOrEqual(def.C2)
      expect(d.C3, `${id} C3 below floor`).toBeGreaterThanOrEqual(def.C3)
      expect(d.C4, `${id} C4 below floor`).toBeGreaterThanOrEqual(def.C4)
      expect(d.C5, `${id} C5 below floor`).toBeGreaterThanOrEqual(def.C5)
      expect(d.C1, `${id} non-monotonic C1>C2`).toBeLessThanOrEqual(d.C2)
      expect(d.C2, `${id} non-monotonic C2>C3`).toBeLessThanOrEqual(d.C3)
      expect(d.C3, `${id} non-monotonic C3>C4`).toBeLessThanOrEqual(d.C4)
      expect(d.C4, `${id} non-monotonic C4>C5`).toBeLessThanOrEqual(d.C5)
    }
  })

  it('preserves source="openf1" provenance after sanitization', () => {
    clearCalibrationRegistry()
    const input: CalibrationProfile = {
      circuitId: 'test-track',
      source: 'openf1',
      tires: {
        degradationRates: { C1: 0.1, C2: 0.1, C3: 0.1, C4: 0.1, C5: 0.1 },
        gripLevels: { C1: 0.88, C2: 0.92, C3: 0.95, C4: 0.98, C5: 1.0 },
        baseTrackTemp: 35,
        wearMultiplier: 1,
      },
      weather: {
        transitionProbabilities: { dry: 0.015, damp: 0.015, wet: 0.015 },
        baseRainProbability: 0.1,
        temperatureRange: { min: 20, max: 45 },
      },
      overtake: { overtakeModifier: 1.0, drsEffectiveness: 0.5 },
      pitLoss: { meanLossSeconds: 21, stddevSeconds: 1.5, sampleCount: 0 },
      stint: {
        expectedLaps: { C1: 32, C2: 26, C3: 20, C4: 15, C5: 11 },
        sampleCount: 0,
      },
    }
    registerCalibrationProfile(input)
    const loaded = loadCalibrationProfile('test-track')
    expect(loaded.source).toBe('openf1')
    hydrateBuiltInProfiles()
  })
})

describe('sanitizePitLossCalibration', () => {
  it('returns defaults when input is undefined', () => {
    const out = sanitizePitLossCalibration(undefined)
    expect(out).toEqual(DEFAULT_PITLOSS_CALIBRATION)
  })

  it('accepts valid inputs verbatim', () => {
    const out = sanitizePitLossCalibration({
      meanLossSeconds: 22.5,
      stddevSeconds: 1.2,
      sampleCount: 18,
    })
    expect(out.meanLossSeconds).toBe(22.5)
    expect(out.stddevSeconds).toBe(1.2)
    expect(out.sampleCount).toBe(18)
  })

  it('replaces non-positive mean with the default', () => {
    const out = sanitizePitLossCalibration({ meanLossSeconds: 0, stddevSeconds: 1, sampleCount: 5 })
    expect(out.meanLossSeconds).toBe(DEFAULT_PITLOSS_CALIBRATION.meanLossSeconds)
  })

  it('replaces negative stddev with the default', () => {
    const out = sanitizePitLossCalibration({ meanLossSeconds: 22, stddevSeconds: -5, sampleCount: 3 })
    expect(out.stddevSeconds).toBe(DEFAULT_PITLOSS_CALIBRATION.stddevSeconds)
  })
})

describe('sanitizeStintCalibration', () => {
  it('returns defaults when input is undefined', () => {
    const out = sanitizeStintCalibration(undefined)
    expect(out).toEqual(DEFAULT_STINT_CALIBRATION)
  })

  it('floors absurdly short per-compound stint lengths to the default', () => {
    // Monza C5=2 style anomaly — a 2-lap stint is a timing glitch
    const out = sanitizeStintCalibration({
      expectedLaps: { C1: 30, C2: 25, C3: 20, C4: 15, C5: 2 },
      sampleCount: 50,
    })
    expect(out.expectedLaps.C5).toBeGreaterThanOrEqual(DEFAULT_STINT_CALIBRATION.expectedLaps.C5 - 2)
  })

  it('caps absurdly long per-compound stint lengths to a realistic maximum', () => {
    // Monaco C3=61 style anomaly — a 61-lap C3 is unlikely to be realistic
    const out = sanitizeStintCalibration({
      expectedLaps: { C1: 80, C2: 70, C3: 61, C4: 51, C5: 11 },
      sampleCount: 23,
    })
    expect(out.expectedLaps.C3).toBeLessThanOrEqual(60)
    expect(out.expectedLaps.C1).toBeLessThanOrEqual(60)
  })

  it('preserves well-ordered realistic values', () => {
    const out = sanitizeStintCalibration({
      expectedLaps: { C1: 34, C2: 28, C3: 22, C4: 16, C5: 12 },
      sampleCount: 75,
    })
    expect(out.expectedLaps.C1).toBe(34)
    expect(out.expectedLaps.C5).toBe(12)
  })
})
