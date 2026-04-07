import { describe, it, expect } from 'vitest'
import { calculateDegradation, getTirePerformance } from '@/engine/race/tire-model'

describe('tire model', () => {
  it('soft tires degrade faster than hard', () => {
    const softDeg = calculateDegradation('C5', 10, { tireWear: 'high' })
    const hardDeg = calculateDegradation('C1', 10, { tireWear: 'high' })
    expect(softDeg).toBeGreaterThan(hardDeg)
  })

  it('high tire wear circuits increase degradation', () => {
    const highWear = calculateDegradation('C3', 10, { tireWear: 'high' })
    const lowWear = calculateDegradation('C3', 10, { tireWear: 'low' })
    expect(highWear).toBeGreaterThan(lowWear)
  })

  it('tire performance decreases as wear increases', () => {
    const fresh = getTirePerformance({ compound: 'C3', label: 'medium', wear: 100, lapsFitted: 0 })
    const worn = getTirePerformance({ compound: 'C3', label: 'medium', wear: 30, lapsFitted: 20 })
    expect(fresh).toBeGreaterThan(worn)
  })

  it('tire cliff: performance drops sharply below 15% wear', () => {
    const beforeCliff = getTirePerformance({ compound: 'C3', label: 'medium', wear: 20, lapsFitted: 25 })
    const afterCliff = getTirePerformance({ compound: 'C3', label: 'medium', wear: 10, lapsFitted: 30 })
    const delta = beforeCliff - afterCliff
    expect(delta).toBeGreaterThan(0.5)
  })
})
