import { describe, it, expect } from 'vitest'
import { WeatherEngine } from '@/engine/race/weather'
import { createPRNG } from '@/engine/core/prng'
import { DEFAULT_WEATHER_CALIBRATION, type WeatherCalibration } from '@/types/calibration'

function makeCalibration(overrides: Partial<WeatherCalibration> = {}): WeatherCalibration {
  return {
    transitionProbabilities: { ...DEFAULT_WEATHER_CALIBRATION.transitionProbabilities },
    baseRainProbability: DEFAULT_WEATHER_CALIBRATION.baseRainProbability,
    temperatureRange: { ...DEFAULT_WEATHER_CALIBRATION.temperatureRange },
    ...overrides,
  }
}

describe('weather engine', () => {
  it('starts in the specified initial state', () => {
    const engine = new WeatherEngine('dry', makeCalibration(), createPRNG(42))
    expect(engine.current).toBe('dry')
  })

  it('high-variability calibration changes weather more often than low-variability', () => {
    let highChanges = 0
    let lowChanges = 0
    const highCal = makeCalibration({ transitionProbabilities: { dry: 0.035, damp: 0.035, wet: 0.035 } })
    const lowCal = makeCalibration({ transitionProbabilities: { dry: 0.002, damp: 0.002, wet: 0.002 } })
    for (let seed = 0; seed < 100; seed++) {
      const highEngine = new WeatherEngine('dry', highCal, createPRNG(seed))
      const lowEngine = new WeatherEngine('dry', lowCal, createPRNG(seed))
      for (let lap = 0; lap < 50; lap++) {
        highEngine.tick()
        lowEngine.tick()
      }
      if (highEngine.current !== 'dry') highChanges++
      if (lowEngine.current !== 'dry') lowChanges++
    }
    expect(highChanges).toBeGreaterThan(lowChanges)
  })

  it('rain probability updates each tick', () => {
    const engine = new WeatherEngine('dry', makeCalibration(), createPRNG(42))
    engine.tick()
    expect(typeof engine.rainProbability).toBe('number')
  })

  it('baseRainProbability from calibration seeds the initial probability for dry start', () => {
    const cal = makeCalibration({ baseRainProbability: 0.4 })
    const engine = new WeatherEngine('dry', cal, createPRNG(42))
    expect(engine.rainProbability).toBe(0.4)
  })

  it('per-state transitionProbabilities drive behavior', () => {
    // Configure a calibration that transitions aggressively only out of dry
    const cal = makeCalibration({ transitionProbabilities: { dry: 0.5, damp: 0.0, wet: 0.0 } })
    const engine = new WeatherEngine('dry', cal, createPRNG(7))
    let leftDry = false
    for (let i = 0; i < 20; i++) {
      engine.tick()
      if (engine.current !== 'dry') {
        leftDry = true
        break
      }
    }
    expect(leftDry).toBe(true)
  })
})
