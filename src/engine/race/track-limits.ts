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
/**
 * Per-race "bad day" exposure model. The per-corner breach rate is multiplied by
 * a factor drawn ONCE per driver per race: a `badDayMult` (>1) on the
 * `badDayProb` fraction of races, else a `normalMult` (<1). This concentrates
 * track-limit trouble into occasional bad races — the only way to hit the spec §7
 * split (12–18 warnings AND 3–5 time penalties) under per-race strike reset, since
 * independent per-corner Bernoulli couples warning volume to escalation depth.
 * INVARIANT: `normalMult < 1 < badDayMult` (mean exposure stays near baseline).
 */
export interface TrackLimitsExposureConfig {
  badDayProb: number   // fraction of races that are a "bad day" for a given driver
  badDayMult: number   // breach-rate multiplier on a bad day (>1)
  normalMult: number   // breach-rate multiplier on a normal day (<1)
}

export interface TrackLimitsConfig {
  /** Per-corner per-lap base breach probability by difficulty tier. */
  baseRateByTier: Record<1 | 2 | 3, number>
  /** Strike thresholds (per race). */
  blackWhiteAt: number      // breach count that shows the black-and-white flag
  timePenaltyAt: number     // breach count that issues the first 5s
  timePenaltySeconds: number
  /** Per-race-per-driver exposure model (see {@link TrackLimitsExposureConfig}). */
  exposure: TrackLimitsExposureConfig
}

/**
 * Calibrated to the spec §7 per-driver/season targets (~12–18 warnings, ~2–3 B&W,
 * ~3–5 time penalties). The `exposure` bad-day model concentrates strikes into
 * occasional bad races so all three bands land simultaneously; measured (exp=70,
 * frus=40, 12-seed mean): warnings ≈16.8, B&W ≈2.5, penalties ≈4.25. Tuned in the
 * env-gated harness (`TRACK_LIMITS_FREQUENCY=1`).
 */
export const DEFAULT_TRACK_LIMITS_CONFIG: TrackLimitsConfig = {
  baseRateByTier: { 1: 0.004, 2: 0.012, 3: 0.022 },
  blackWhiteAt: 4,
  timePenaltyAt: 5,
  timePenaltySeconds: 5,
  exposure: { badDayProb: 0.32, badDayMult: 2.2, normalMult: 0.1 },
}

export interface TrackLimitBreachInput {
  difficultyTier: 1 | 2 | 3
  experience: number   // 0-100; higher → fewer breaches
  frustration: number  // 0-100; higher → more breaches // source: driver.mood.frustration
  /** Per-race-per-driver exposure multiplier from {@link rollTrackLimitExposure}; defaults to 1. */
  exposureFactor?: number
  config: TrackLimitsConfig
}

/**
 * Roll a driver's per-race track-limits exposure factor. Consumes exactly one
 * PRNG draw — call ONCE per driver per race from an isolated PRNG (e.g.
 * `createPRNG(mixSeed(raceSeed, driverHash))`) so the main loop stream is
 * unperturbed. Pure & deterministic.
 */
export function rollTrackLimitExposure(rng: PRNG, config: TrackLimitsConfig): number {
  const e = config.exposure
  return rng.chance(e.badDayProb) ? e.badDayMult : e.normalMult
}

/**
 * Roll whether a single monitored corner is breached on this lap. Consumes
 * exactly one PRNG draw (regardless of `exposureFactor`, so the stream position
 * is independent of the bad-day model). Pure & deterministic.
 */
export function evaluateTrackLimitBreach(input: TrackLimitBreachInput, rng: PRNG): boolean {
  const base = input.config.baseRateByTier[input.difficultyTier]
  // Experience reduces rate (1.0 at 0 exp → 0.4 at 100 exp).
  const expFactor = 1 - (input.experience / 100) * 0.6
  // Frustration raises rate (1.0 at 0 → 1.5 at 100).
  const frustrationFactor = 1 + (input.frustration / 100) * 0.5
  // Per-race bad-day exposure (defaults to 1 → neutral when not supplied).
  const exposure = input.exposureFactor ?? 1
  const prob = Math.min(base * expFactor * frustrationFactor * exposure, 0.25)
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
