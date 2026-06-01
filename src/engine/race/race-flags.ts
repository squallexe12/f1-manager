import type { PRNG } from '@/engine/core/prng'
import type { RaceFlag } from '@/types/race'
import type { CautionSeverity } from './race-incidents'

/** A caution flag is any non-green RaceFlag. */
export type CautionFlag = Exclude<RaceFlag, 'green'>

export interface RaceFlagsConfig {
  /**
   * Cumulative probability bands for a MINOR caution (debris/spin/mechanical):
   * in [0,1], ordered least → most severe. One PRNG draw; the first band whose
   * threshold exceeds the draw is selected.
   */
  severityBands: { yellow: number; vsc: number; sc: number; red: number }
  /**
   * Cumulative bands for a MAJOR caution (heavy shunt). Skewed toward SC/red so
   * a big crash leans to a full safety car.
   */
  majorSeverityBands: { yellow: number; vsc: number; sc: number; red: number }
  /** How many laps each caution flag is held before returning to green. */
  durationLaps: Record<CautionFlag, number>
}

/**
 * Minor bands (debris/spin/mechanical): yellow most common, red rare.
 * Major bands (heavy shunt): ~5% yellow, ~15% VSC, ~65% full SC, ~15% red —
 * the "big crash → full SC" requirement. Both are starting values; the major
 * split is tuned in IP-4.
 */
export const DEFAULT_CAUTION_CONFIG: RaceFlagsConfig = {
  severityBands: { yellow: 0.55, vsc: 0.8, sc: 0.97, red: 1.0 },
  majorSeverityBands: { yellow: 0.05, vsc: 0.2, sc: 0.85, red: 1.0 },
  durationLaps: { yellow: 1, vsc: 2, sc: 4, red: 3 },
}

/** Roll a caution flag from a single PRNG draw, selecting the band set by severity. */
export function rollCautionFlag(rng: PRNG, config: RaceFlagsConfig, severity: CautionSeverity): CautionFlag {
  const r = rng.next()
  const b = severity === 'major' ? config.majorSeverityBands : config.severityBands
  if (r < b.yellow) return 'yellow'
  if (r < b.vsc) return 'vsc'
  if (r < b.sc) return 'sc'
  return 'red'
}

/** Laps a given caution flag is held. */
export function cautionDurationLaps(flag: CautionFlag, config: RaceFlagsConfig): number {
  return config.durationLaps[flag]
}

export interface RaceFlagsTransition {
  safetyCar: RaceFlag
  cautionLapsRemaining: number
  /** The flag just deployed this lap (for radio/commentary), else null. */
  deployed: CautionFlag | null
  /** True on the lap the caution just cleared back to green. */
  cleared: boolean
}

/**
 * Advance the caution FSM by one lap. Pure: returns the next flag state.
 *
 * Determinism: consumes EXACTLY ONE PRNG draw, and only when a fresh caution is
 * deployed (green + non-null trigger). The green-no-trigger path and the
 * already-under-caution path draw zero PRNG — this is load-bearing for keeping
 * existing seeded race tests byte-identical.
 */
export function advanceRaceFlags(
  state: { safetyCar: RaceFlag; cautionLapsRemaining: number },
  rng: PRNG,
  trigger: CautionSeverity | null,
  config: RaceFlagsConfig,
): RaceFlagsTransition {
  // Under caution: decrement, clear to green at zero. No PRNG.
  if (state.safetyCar !== 'green') {
    const remaining = state.cautionLapsRemaining - 1
    if (remaining <= 0) {
      return { safetyCar: 'green', cautionLapsRemaining: 0, deployed: null, cleared: true }
    }
    return { safetyCar: state.safetyCar, cautionLapsRemaining: remaining, deployed: null, cleared: false }
  }
  // Green + trigger: deploy with a severity-biased band roll. One PRNG draw.
  if (trigger !== null) {
    const flag = rollCautionFlag(rng, config, trigger)
    return {
      safetyCar: flag,
      cautionLapsRemaining: cautionDurationLaps(flag, config),
      deployed: flag,
      cleared: false,
    }
  }
  // Green + no trigger. No PRNG.
  return { safetyCar: 'green', cautionLapsRemaining: 0, deployed: null, cleared: false }
}
