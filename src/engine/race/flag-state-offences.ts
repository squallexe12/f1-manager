import type { PRNG } from '@/engine/core/prng'
import type { OffenceType, SeverityTier } from '@/types/race'

export type CautionFlag = 'yellow' | 'vsc' | 'sc' | 'red'

export interface FlagOffenceConfig {
  /** Base breach probability for an aggressive driver, by active flag. */
  baseRateByFlag: Record<CautionFlag, number>
  severityBands: { minor: number; serious: number; major: number }
}

/** Calibrated toward ~0–1 of each flag offence per driver/season. */
export const DEFAULT_FLAG_OFFENCE_CONFIG: FlagOffenceConfig = {
  baseRateByFlag: { yellow: 0.06, vsc: 0.05, sc: 0.07, red: 0.04 },
  severityBands: { minor: 0.45, serious: 0.75, major: 0.92 },
}

export function offenceTypeForFlag(flag: CautionFlag): OffenceType {
  switch (flag) {
    case 'yellow': return 'yellow-flag-breach'
    case 'sc': return 'sc-infraction'
    case 'vsc': return 'vsc-infraction'
    case 'red': return 'red-flag-breach'
  }
}

export interface FlagBreachInput {
  driverId: string
  flag: CautionFlag
  aggressive: boolean   // running 'overtake' or 'push' under caution
  experience: number    // 0-100; higher → fewer breaches
  mentality: number     // 0-100; higher → more disciplined under pressure
  config: FlagOffenceConfig
}

export interface FlagBreachEvaluation {
  decision: null | { driverId: string; severity: SeverityTier; offenceType: OffenceType }
  /** True for VSC (automatic), false for yellow/sc/red (open an investigation). */
  automatic: boolean
}

/**
 * Decide whether an aggressive driver under a caution flag commits a flag breach.
 * Consumes ZERO PRNG when the driver is not aggressive (gate), up to two draws
 * otherwise (incidence + severity). Pure & deterministic.
 */
export function evaluateFlagStateBreach(input: FlagBreachInput, rng: PRNG): FlagBreachEvaluation {
  const automatic = input.flag === 'vsc'
  if (!input.aggressive) {
    return { decision: null, automatic }
  }
  const base = input.config.baseRateByFlag[input.flag]
  // Experience + mentality both reduce the rate (average of the two deficits).
  const discipline = (input.experience + input.mentality) / 2
  const disciplineFactor = 1 - (discipline / 100) * 0.85
  const prob = Math.min(base * disciplineFactor, 0.4)
  if (!rng.chance(prob)) {
    return { decision: null, automatic }
  }
  const sevScore = rng.next()
  const b = input.config.severityBands
  let severity: SeverityTier
  if (sevScore < b.minor) severity = 'minor'
  else if (sevScore < b.serious) severity = 'serious'
  else if (sevScore < b.major) severity = 'major'
  else severity = 'egregious'
  return {
    decision: { driverId: input.driverId, severity, offenceType: offenceTypeForFlag(input.flag) },
    automatic,
  }
}
