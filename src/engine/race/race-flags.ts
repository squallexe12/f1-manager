import type { PRNG } from '@/engine/core/prng'
import type { RaceFlag } from '@/types/race'

/** A caution flag is any non-green RaceFlag. */
export type CautionFlag = Exclude<RaceFlag, 'green'>

export interface RaceFlagsConfig {
  /**
   * Cumulative probability bands for the severity roll, in [0,1). The roll
   * draws once from the PRNG; the first band whose threshold exceeds the draw
   * is selected. Ordered least → most severe.
   */
  severityBands: { yellow: number; vsc: number; sc: number; red: number }
  /** How many laps each caution flag is held before returning to green. */
  durationLaps: Record<CautionFlag, number>
}

/**
 * Calibrated so the most common outcome is a brief yellow, sc is uncommon, and
 * red is rare. Thresholds are cumulative: draw < 0.55 → yellow, < 0.80 → vsc,
 * < 0.97 → sc, else red.
 */
export const DEFAULT_CAUTION_CONFIG: RaceFlagsConfig = {
  severityBands: { yellow: 0.55, vsc: 0.8, sc: 0.97, red: 1.0 },
  durationLaps: { yellow: 1, vsc: 2, sc: 4, red: 3 },
}

/** Roll a caution flag from a single PRNG draw using cumulative severity bands. */
export function rollCautionFlag(rng: PRNG, config: RaceFlagsConfig): CautionFlag {
  const r = rng.next()
  const b = config.severityBands
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
 * deployed (green + triggerCaution). The green-no-trigger path and the
 * already-under-caution path draw zero PRNG — this is load-bearing for keeping
 * existing seeded race tests byte-identical.
 */
export function advanceRaceFlags(
  state: { safetyCar: RaceFlag; cautionLapsRemaining: number },
  rng: PRNG,
  triggerCaution: boolean,
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
  // Green + trigger: deploy. One PRNG draw.
  if (triggerCaution) {
    const flag = rollCautionFlag(rng, config)
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
