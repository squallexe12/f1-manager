import type { WeatherState } from '@/types/race'
import type { PRNG } from '@/engine/core/prng'

const VARIABILITY_CHANCE: Record<string, number> = {
  low: 0.002,    // ~0.2% per lap
  medium: 0.015, // ~1.5% per lap
  high: 0.035,   // ~3.5% per lap
}

const TRANSITIONS: Record<WeatherState, WeatherState[]> = {
  dry: ['damp'],
  damp: ['dry', 'wet'],
  wet: ['damp'],
}

export class WeatherEngine {
  current: WeatherState
  rainProbability: number
  private variability: string
  private rng: PRNG
  private lapsSinceChange: number

  constructor(initial: WeatherState, variability: string, rng: PRNG) {
    this.current = initial
    this.variability = variability
    this.rng = rng
    this.rainProbability = initial === 'dry' ? 0.1 : initial === 'damp' ? 0.5 : 0.8
    this.lapsSinceChange = 0
  }

  tick(): void {
    this.lapsSinceChange++
    const baseChance = VARIABILITY_CHANCE[this.variability] ?? 0.015

    // Transition probability increases the longer we've been in one state
    const timeFactor = Math.min(2, 1 + this.lapsSinceChange * 0.01)
    const transitionChance = baseChance * timeFactor

    if (this.rng.chance(transitionChance)) {
      const options = TRANSITIONS[this.current]
      this.current = this.rng.pick(options)
      this.lapsSinceChange = 0
    }

    // Update rain probability based on current state
    const targetProb = this.current === 'dry' ? 0.1 : this.current === 'damp' ? 0.5 : 0.85
    this.rainProbability += (targetProb - this.rainProbability) * 0.2

    // Add some noise
    this.rainProbability = Math.max(0, Math.min(1,
      this.rainProbability + (this.rng.next() - 0.5) * 0.05
    ))
  }

  getForecast(lapsAhead: number): { current: WeatherState; rainProbability: number; changeInLaps: number | null } {
    return {
      current: this.current,
      rainProbability: this.rainProbability,
      changeInLaps: this.rainProbability > 0.4 ? Math.round(lapsAhead * (1 - this.rainProbability)) : null,
    }
  }
}
