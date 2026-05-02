import type { PRNG } from './prng'

/**
 * Box-Muller transform — turns two uniform samples from a seeded PRNG into a
 * standard-normal sample (mean 0, stddev 1). Multiply by σ and add μ to land
 * on `N(μ, σ)`.
 *
 * Used by:
 *   - race-simulator pit-loss scatter (existing)
 *   - pit-lane FSM speed-drift sampling (Tier B)
 *
 * A uniform sampler would understate variance by ~42% and hard-cap at ±σ,
 * erasing the rare-tail events the calibration is meant to represent.
 */
export function sampleGaussian(rng: PRNG): number {
  const u1 = Math.max(rng.next(), 1e-9) // avoid log(0)
  const u2 = rng.next()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}
