import type { PRNG } from '@/engine/core/prng'

/**
 * Track-limits strike FSM tuning.
 *
 * INVARIANT: `blackWhiteAt < timePenaltyAt`. The strike escalation in
 * `applyTrackLimitStrike` checks the time-penalty threshold first, so if
 * `blackWhiteAt >= timePenaltyAt` the black-and-white branch becomes
 * unreachable (every strike at/over `blackWhiteAt` would already be a
 * time penalty). Keep the black-and-white step strictly below the penalty step.
 */
export interface TrackLimitsConfig {
  /** Per-corner per-lap base breach probability by difficulty tier. */
  baseRateByTier: Record<1 | 2 | 3, number>
  /** Strike thresholds (per race). */
  blackWhiteAt: number      // breach count that shows the black-and-white flag
  timePenaltyAt: number     // breach count that issues the first 5s
  timePenaltySeconds: number
}

/**
 * Calibrated toward ~12–18 warnings + ~3–5 time penalties per driver per 24-race
 * season (IP-C2 target). Tuned in the env-gated harness (Task 13).
 */
export const DEFAULT_TRACK_LIMITS_CONFIG: TrackLimitsConfig = {
  baseRateByTier: { 1: 0.004, 2: 0.012, 3: 0.022 },
  blackWhiteAt: 4,
  timePenaltyAt: 5,
  timePenaltySeconds: 5,
}

export interface TrackLimitBreachInput {
  difficultyTier: 1 | 2 | 3
  experience: number   // 0-100; higher → fewer breaches
  frustration: number  // 0-100; higher → more breaches // source: driver.mood.frustration
  config: TrackLimitsConfig
}

/**
 * Roll whether a single monitored corner is breached on this lap. Consumes
 * exactly one PRNG draw. Pure & deterministic.
 */
export function evaluateTrackLimitBreach(input: TrackLimitBreachInput, rng: PRNG): boolean {
  const base = input.config.baseRateByTier[input.difficultyTier]
  // Experience reduces rate (1.0 at 0 exp → 0.4 at 100 exp).
  const expFactor = 1 - (input.experience / 100) * 0.6
  // Frustration raises rate (1.0 at 0 → 1.5 at 100).
  const frustrationFactor = 1 + (input.frustration / 100) * 0.5
  const prob = Math.min(base * expFactor * frustrationFactor, 0.25)
  return rng.chance(prob)
}

export type TrackLimitOutcome = 'warning' | 'black-and-white' | 'time-penalty'

export interface TrackLimitStrikeResult {
  strikes: number
  outcome: TrackLimitOutcome
  timePenaltySeconds: number
}

/**
 * Apply one breach to a driver's running strike count and return the escalation
 * outcome. Pure: takes the prior strike count, returns the next. No PRNG.
 */
export function applyTrackLimitStrike(
  priorStrikes: number,
  config: TrackLimitsConfig,
): TrackLimitStrikeResult {
  const strikes = priorStrikes + 1
  if (strikes >= config.timePenaltyAt) {
    return { strikes, outcome: 'time-penalty', timePenaltySeconds: config.timePenaltySeconds }
  }
  if (strikes === config.blackWhiteAt) {
    return { strikes, outcome: 'black-and-white', timePenaltySeconds: 0 }
  }
  return { strikes, outcome: 'warning', timePenaltySeconds: 0 }
}
