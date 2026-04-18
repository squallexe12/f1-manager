import { describe, it, expect } from 'vitest'
import { calculateDegradation, getTirePerformance, degradeTire } from '@/engine/race/tire-model'
import { DEFAULT_TIRE_CALIBRATION, type TireCalibration } from '@/types/calibration'

function makeCalibration(overrides: Partial<TireCalibration> = {}): TireCalibration {
  return {
    degradationRates: { ...DEFAULT_TIRE_CALIBRATION.degradationRates },
    gripLevels: { ...DEFAULT_TIRE_CALIBRATION.gripLevels },
    baseTrackTemp: DEFAULT_TIRE_CALIBRATION.baseTrackTemp,
    wearMultiplier: DEFAULT_TIRE_CALIBRATION.wearMultiplier,
    ...overrides,
  }
}

describe('tire model', () => {
  it('soft tires degrade faster than hard', () => {
    const cal = makeCalibration({ wearMultiplier: 1.4 })
    const softDeg = calculateDegradation('C5', 10, cal)
    const hardDeg = calculateDegradation('C1', 10, cal)
    expect(softDeg).toBeGreaterThan(hardDeg)
  })

  it('higher wearMultiplier increases degradation', () => {
    const highWear = calculateDegradation('C3', 10, makeCalibration({ wearMultiplier: 1.4 }))
    const lowWear = calculateDegradation('C3', 10, makeCalibration({ wearMultiplier: 0.7 }))
    expect(highWear).toBeGreaterThan(lowWear)
  })

  it('tire performance decreases as wear increases', () => {
    const cal = makeCalibration()
    const fresh = getTirePerformance({ compound: 'C3', label: 'medium', wear: 100, lapsFitted: 0 }, cal)
    const worn = getTirePerformance({ compound: 'C3', label: 'medium', wear: 30, lapsFitted: 20 }, cal)
    expect(fresh).toBeGreaterThan(worn)
  })

  it('tire cliff: performance drops sharply below 15% wear', () => {
    const cal = makeCalibration()
    const beforeCliff = getTirePerformance({ compound: 'C3', label: 'medium', wear: 20, lapsFitted: 25 }, cal)
    const afterCliff = getTirePerformance({ compound: 'C3', label: 'medium', wear: 10, lapsFitted: 30 }, cal)
    const delta = beforeCliff - afterCliff
    expect(delta).toBeGreaterThan(0.5)
  })

  it('calibration degradationRates override the defaults', () => {
    const aggressive = makeCalibration({
      degradationRates: { C1: 5.0, C2: 5.0, C3: 5.0, C4: 5.0, C5: 5.0 },
    })
    const gentle = makeCalibration({
      degradationRates: { C1: 0.1, C2: 0.1, C3: 0.1, C4: 0.1, C5: 0.1 },
    })
    expect(calculateDegradation('C3', 10, aggressive)).toBeGreaterThan(calculateDegradation('C3', 10, gentle))
  })

  it('calibration gripLevels override the defaults', () => {
    const gripful = makeCalibration({
      gripLevels: { C1: 1.0, C2: 1.0, C3: 1.0, C4: 1.0, C5: 1.0 },
    })
    const slippery = makeCalibration({
      gripLevels: { C1: 0.5, C2: 0.5, C3: 0.5, C4: 0.5, C5: 0.5 },
    })
    const tire = { compound: 'C3' as const, label: 'medium' as const, wear: 100, lapsFitted: 0 }
    expect(getTirePerformance(tire, gripful)).toBeGreaterThan(getTirePerformance(tire, slippery))
  })

  it('degradeTire reduces wear based on calibration', () => {
    const cal = makeCalibration({ wearMultiplier: 1.0 })
    const fresh = { compound: 'C5' as const, label: 'soft' as const, wear: 100, lapsFitted: 0 }
    const afterOne = degradeTire(fresh, cal)
    expect(afterOne.wear).toBeLessThan(100)
    expect(afterOne.lapsFitted).toBe(1)
  })

  it('trackTemp defaults to calibration.baseTrackTemp when omitted', () => {
    const cal = makeCalibration({ baseTrackTemp: 30 })
    const defaulted = calculateDegradation('C3', 10, cal)
    const explicit = calculateDegradation('C3', 10, cal, 30)
    expect(defaulted).toBe(explicit)
  })

  it('trackTemp above baseline increases degradation', () => {
    const cal = makeCalibration({ baseTrackTemp: 25 })
    const atBase = calculateDegradation('C3', 10, cal, 25)
    const hotter = calculateDegradation('C3', 10, cal, 45)
    expect(hotter).toBeGreaterThan(atBase)
  })
})
