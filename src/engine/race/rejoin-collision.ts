import type { PRNG } from '@/engine/core/prng'
import type { SeverityTier } from '@/types/race'

export interface RejoinCollisionConfig {
  /** Base collision probability given an off-track rejoin, by corner rejoinRisk. */
  baseRateByRisk: Record<'low' | 'med' | 'high', number>
  /** Severity thresholds applied to the rolled severity score (0-1). */
  severityBands: { minor: number; serious: number; major: number }
}

/**
 * Calibrated to spec §7 (~1–2 rejoin-collision investigations per driver/season).
 * Base rates scaled to half of the IP-C3 starting values once the track-limits
 * bad-day exposure model (which gates these rolls) brought the gate-open rate to
 * its intended level; measured (racecraft=60/exp=70/frus=40, 12-seed mean) ≈1.58.
 */
export const DEFAULT_REJOIN_CONFIG: RejoinCollisionConfig = {
  baseRateByRisk: { low: 0.025, med: 0.09, high: 0.16 },
  severityBands: { minor: 0.4, serious: 0.7, major: 0.9 },
}

export interface RejoinCollisionInput {
  driverId: string
  rejoinRisk: 'low' | 'med' | 'high'
  racecraft: number   // 0-100; higher → safer rejoin
  config: RejoinCollisionConfig
}

export interface RejoinCollisionEvaluation {
  decision: null | { driverId: string; severity: SeverityTier; offenceType: 'rejoin-collision' }
}

/**
 * Given a driver who has run off at a corner, decide whether the rejoin causes a
 * reportable collision. Consumes up to two PRNG draws (incidence, then severity).
 * Pure & deterministic.
 */
export function evaluateRejoinCollision(
  input: RejoinCollisionInput,
  rng: PRNG,
): RejoinCollisionEvaluation {
  const base = input.config.baseRateByRisk[input.rejoinRisk]
  // Racecraft reduces collision probability (1.0 at 0 → 0.35 at 100).
  const skillFactor = 1 - (input.racecraft / 100) * 0.65
  const prob = Math.min(base * skillFactor, 0.5)
  if (!rng.chance(prob)) {
    return { decision: null }
  }
  const sevScore = rng.next()
  const b = input.config.severityBands
  let severity: SeverityTier
  if (sevScore < b.minor) severity = 'minor'
  else if (sevScore < b.serious) severity = 'serious'
  else if (sevScore < b.major) severity = 'major'
  else severity = 'egregious'
  return { decision: { driverId: input.driverId, severity, offenceType: 'rejoin-collision' } }
}
