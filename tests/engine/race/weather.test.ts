import { describe, it, expect } from 'vitest'
import { WeatherEngine } from '@/engine/race/weather'
import { createPRNG } from '@/engine/core/prng'

describe('weather engine', () => {
  it('starts in the specified initial state', () => {
    const engine = new WeatherEngine('dry', 'medium', createPRNG(42))
    expect(engine.current).toBe('dry')
  })

  it('high variability circuits change weather more often', () => {
    let changes = 0
    for (let seed = 0; seed < 100; seed++) {
      const engine = new WeatherEngine('dry', 'high', createPRNG(seed))
      for (let lap = 0; lap < 50; lap++) engine.tick()
      if (engine.current !== 'dry') changes++
    }
    expect(changes).toBeGreaterThan(20)
  })

  it('low variability circuits rarely change weather', () => {
    let changes = 0
    for (let seed = 0; seed < 100; seed++) {
      const engine = new WeatherEngine('dry', 'low', createPRNG(seed))
      for (let lap = 0; lap < 50; lap++) engine.tick()
      if (engine.current !== 'dry') changes++
    }
    expect(changes).toBeLessThan(15)
  })

  it('rain probability updates each tick', () => {
    const engine = new WeatherEngine('dry', 'high', createPRNG(42))
    engine.tick()
    expect(typeof engine.rainProbability).toBe('number')
  })
})
