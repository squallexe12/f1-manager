import type { PRNG } from '@/engine/core/prng'

export interface PitLineConfig {
  /** Base crossing probability per lane boundary transit. */
  baseRateByBoundary: { entry: number; exit: number }
}

/** Calibrated toward ~0–1 crossings per driver/season across all pit stops. */
export const DEFAULT_PIT_LINE_CONFIG: PitLineConfig = {
  baseRateByBoundary: { entry: 0.010, exit: 0.014 },
}

export interface PitLineInput {
  boundary: 'entry' | 'exit'
  experience: number   // 0-100; higher → fewer crossings
  config: PitLineConfig
}

/**
 * Decide whether a car crosses the pit-entry/exit white line on this transit.
 * Consumes exactly one PRNG draw. Pure & deterministic.
 */
export function evaluatePitLineCrossing(input: PitLineInput, rng: PRNG): boolean {
  const base = input.config.baseRateByBoundary[input.boundary]
  // Experience reduces the rate (1.0 at 0 → 0.3 at 100).
  const expFactor = 1 - (input.experience / 100) * 0.7
  const prob = Math.min(base * expFactor, 0.1)
  return rng.chance(prob)
}
