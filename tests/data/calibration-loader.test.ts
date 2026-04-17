import { describe, it, expect } from 'vitest'
import {
  loadCalibrationProfile,
  registerCalibrationProfile,
  clearCalibrationRegistry,
  listRegisteredCircuits,
} from '@/data/calibration'
import type { CalibrationProfile } from '@/types/calibration'
import { createFallbackProfile } from '@/types/calibration'

function buildProfile(circuitId: string, source: CalibrationProfile['source'] = 'openf1'): CalibrationProfile {
  return {
    ...createFallbackProfile(circuitId),
    source,
  }
}

describe('loadCalibrationProfile', () => {
  it('returns a fallback profile when circuit is not registered', () => {
    clearCalibrationRegistry()
    const profile = loadCalibrationProfile('unknown-circuit')
    expect(profile.circuitId).toBe('unknown-circuit')
    expect(profile.source).toBe('fallback')
  })

  it('returns the registered profile when circuit is registered', () => {
    clearCalibrationRegistry()
    const bahrain = buildProfile('bahrain', 'openf1')
    registerCalibrationProfile(bahrain)
    const loaded = loadCalibrationProfile('bahrain')
    expect(loaded.circuitId).toBe('bahrain')
    expect(loaded.source).toBe('openf1')
  })

  it('never throws even if an invalid circuitId is passed', () => {
    clearCalibrationRegistry()
    expect(() => loadCalibrationProfile('')).not.toThrow()
    expect(() => loadCalibrationProfile('missing')).not.toThrow()
  })

  it('returns deeply independent copies (caller mutation does not leak)', () => {
    clearCalibrationRegistry()
    const monaco = buildProfile('monaco', 'curated')
    registerCalibrationProfile(monaco)

    const first = loadCalibrationProfile('monaco')
    first.tires.wearMultiplier = 999

    const second = loadCalibrationProfile('monaco')
    expect(second.tires.wearMultiplier).not.toBe(999)
  })
})

describe('registerCalibrationProfile', () => {
  it('stores the profile so it can be loaded by circuitId', () => {
    clearCalibrationRegistry()
    registerCalibrationProfile(buildProfile('spa'))
    expect(listRegisteredCircuits()).toContain('spa')
  })

  it('overwrites an existing profile for the same circuitId', () => {
    clearCalibrationRegistry()
    registerCalibrationProfile(buildProfile('spa', 'fallback'))
    registerCalibrationProfile(buildProfile('spa', 'openf1'))
    expect(loadCalibrationProfile('spa').source).toBe('openf1')
  })
})

describe('listRegisteredCircuits', () => {
  it('returns an empty array when no profiles are registered', () => {
    clearCalibrationRegistry()
    expect(listRegisteredCircuits()).toEqual([])
  })

  it('returns all registered circuitIds', () => {
    clearCalibrationRegistry()
    registerCalibrationProfile(buildProfile('monza'))
    registerCalibrationProfile(buildProfile('silverstone'))
    const circuits = listRegisteredCircuits()
    expect(circuits).toHaveLength(2)
    expect(circuits).toContain('monza')
    expect(circuits).toContain('silverstone')
  })
})
