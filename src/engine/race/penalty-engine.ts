import type { OffenceType, SeverityTier, DriverCommand, SanctionType } from '@/types/race'
import type { PRNG } from '@/engine/core/prng'
import type { RaceDriver } from './race-simulator'
import type { PenaltyCalibration } from '@/data/penalty-calibration'

export interface ContestedEventInput {
  attacker: RaceDriver
  defender: RaceDriver
  attackerCommand: DriverCommand
  defenderCommand: DriverCommand
  lapDelta: number
  tireDelta: number
  circuit: { overtakingDifficulty: 'low' | 'medium' | 'high' }
  attackerMood: { frustration: number; confidence: number }
  defenderMood: { frustration: number; confidence: number }
  calibration: PenaltyCalibration
}

export interface FaultEvaluation {
  attackerFault: number
  defenderFault: number
  decision: null | { driverId: string; severity: SeverityTier; offenceType: OffenceType }
}

const COMMAND_AGGRESSION: Record<DriverCommand, number> = {
  overtake: 0.30,
  push: 0.15,
  defend: 0.20,
  standard: 0,
  conserve: 0,
  pit: 0,
}

const CIRCUIT_DIFFICULTY: Record<'low' | 'medium' | 'high', number> = {
  low: 0.0,
  medium: 0.05,
  high: 0.10,
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function computeAttackerFault(input: ContestedEventInput): number {
  const { attacker, attackerCommand, tireDelta, circuit, attackerMood } = input
  const aggression = COMMAND_AGGRESSION[attackerCommand]
  const optimism = (100 - attacker.attributes.racecraft) / 200
  const frustration = Math.max(0, attackerMood.frustration - 60) / 200
  const tireMismatch = Math.max(0, -tireDelta) * 0.005
  const circuitRisk = CIRCUIT_DIFFICULTY[circuit.overtakingDifficulty]
  const experienceProtection = attacker.attributes.experience / 500
  return clamp01(aggression + optimism + frustration + tireMismatch + circuitRisk - experienceProtection)
}

function computeDefenderFault(input: ContestedEventInput): number {
  const { defender, defenderCommand, circuit, defenderMood } = input
  const aggression = COMMAND_AGGRESSION[defenderCommand]
  const optimism = (100 - defender.attributes.racecraft) / 200
  const frustration = Math.max(0, defenderMood.frustration - 60) / 200
  const circuitRisk = CIRCUIT_DIFFICULTY[circuit.overtakingDifficulty]
  const experienceProtection = defender.attributes.experience / 500
  // Tire-mismatch risk is attacker-only; defenders don't get blamed for old tires.
  return clamp01(aggression + optimism + frustration + circuitRisk - experienceProtection)
}

export function severityFromScore(
  score: number,
  threshold: number,
  bands: PenaltyCalibration['severityBands'],
): SeverityTier {
  const over = score - threshold
  if (over < bands.minor) return 'minor'
  if (over < bands.serious) return 'serious'
  if (over < bands.major) return 'major'
  return 'egregious'
}

export function evaluateContestedEvent(
  input: ContestedEventInput,
  _rng: PRNG,
): FaultEvaluation {
  const attackerFault = computeAttackerFault(input)
  const defenderFault = computeDefenderFault(input)
  const threshold = input.calibration.faultThreshold
  const max = Math.max(attackerFault, defenderFault)
  if (max < threshold) {
    return { attackerFault, defenderFault, decision: null }
  }
  // Tie → attacker blame (per spec §5.1.3)
  const blamedIsAttacker = attackerFault >= defenderFault
  const driverId = blamedIsAttacker ? input.attacker.id : input.defender.id
  const blamedScore = blamedIsAttacker ? attackerFault : defenderFault
  const severity = severityFromScore(blamedScore, threshold, input.calibration.severityBands)
  let offenceType: OffenceType
  if (blamedIsAttacker) {
    if (input.attackerCommand === 'overtake') {
      offenceType = severity === 'minor' || severity === 'serious'
        ? (severity === 'minor' ? 'collision-minor' : 'collision-serious')
        : 'collision-serious'
    } else {
      offenceType = 'forcing-off'
    }
  } else {
    offenceType = 'illegal-defending'
  }
  return { attackerFault, defenderFault, decision: { driverId, severity, offenceType } }
}

export interface PendingInvestigation {
  id: string
  driverId: string
  openedOnLap: number
  decideOnLap: number
  severity: SeverityTier
  offenceType: OffenceType
}

export function openInvestigation(
  driverId: string,
  severity: SeverityTier,
  offenceType: OffenceType,
  currentLap: number,
  totalLaps: number,
  calibration: PenaltyCalibration,
  rng: PRNG,
): PendingInvestigation {
  // Use rng.next() to drive a deterministic window pick. We don't use rng.range
  // directly so the seeded value is encoded into the id for traceability.
  const r = rng.next()
  const { minLaps, maxLaps } = calibration.investigationWindow
  const offset = minLaps + Math.floor(r * (maxLaps - minLaps + 1))
  const decideOnLap = Math.min(currentLap + offset, totalLaps)
  const id = `inv-${currentLap}-${driverId}-${Math.floor(r * 1e9)}`
  return { id, driverId, openedOnLap: currentLap, decideOnLap, severity, offenceType }
}

export function resolveInvestigations(
  pending: PendingInvestigation[],
  currentLap: number,
): { resolved: PendingInvestigation[]; stillPending: PendingInvestigation[] } {
  const resolved: PendingInvestigation[] = []
  const stillPending: PendingInvestigation[] = []
  for (const inv of pending) {
    if (currentLap >= inv.decideOnLap) resolved.push(inv)
    else stillPending.push(inv)
  }
  return { resolved, stillPending }
}

export function selectSanction(
  severity: SeverityTier,
  offenceType: OffenceType,
  calibration: PenaltyCalibration,
  _rng: PRNG,
): {
  sanction: SanctionType
  timePenaltySeconds: number
  penaltyPoints: number
  warningCounted: boolean
} {
  const cell = calibration.sanctionMatrix[offenceType][severity]
  return {
    sanction: cell.sanction,
    timePenaltySeconds: cell.timePenaltySeconds,
    penaltyPoints: cell.penaltyPoints,
    warningCounted: cell.warningCounted,
  }
}
