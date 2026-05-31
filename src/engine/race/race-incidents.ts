import type { PRNG } from '@/engine/core/prng'

/**
 * Severity of a caution-worthy incident. Drives cause-biased flag selection in
 * `race-flags.ts`: `'minor'` (debris/spin/mechanical) leans yellow/VSC; `'major'`
 * (heavy shunt) leans full SC/red.
 */
export type CautionSeverity = 'minor' | 'major'

export type IncidentKind = 'crash' | 'mechanical'

export interface RaceIncidentConfig {
  /** Per-car per-lap base crash probability (before attribute/weather factors). */
  crashBaseHazard: number
  /** Per-car per-lap base mechanical-failure probability (before factors). */
  mechanicalBaseHazard: number
  /** Fraction of non-major crashes that are on-track / caution-worthy. */
  crashCautionShare: number
  /** Fraction of crashes that are heavy shunts — always caution-worthy, SC/red-leaning. */
  crashMajorShare: number
  /** Fraction of mechanical retirements that stop on track (caution-worthy). */
  mechanicalCautionShare: number
  /** Crash-hazard multiplier when the track is wet/damp. */
  wetCrashMultiplier: number
}

/**
 * Starting hazards. Calibrated in IP-4 against the env-gated season harness to
 * land ~1–3 retirements/race and ~0.5–0.7 full SC/race. The caution shares and
 * wet multiplier shape the mix; the two base hazards scale the magnitude.
 */
export const DEFAULT_RACE_INCIDENT_CONFIG: RaceIncidentConfig = {
  crashBaseHazard: 0.0011,
  mechanicalBaseHazard: 0.0009,
  crashCautionShare: 0.6,
  crashMajorShare: 0.4,
  mechanicalCautionShare: 0.4,
  wetCrashMultiplier: 2.2,
}

/** Upper bound on any per-lap hazard after factors, so attribute extremes cannot explode it. */
const MAX_INCIDENT_HAZARD = 0.5

/**
 * Lap-fraction wear multiplier weight for mechanical hazard: hazard scales by
 * `1 + lapFraction * MECHANICAL_WEAR_FACTOR`, so failures roughly double by race
 * end. This is the "simple lap-fraction factor" the spec permits (no richer
 * component-wear model in this workstream).
 */
const MECHANICAL_WEAR_FACTOR = 1.0

export interface IncidentRoll {
  driverId: string
  kind: IncidentKind
  /** Crashes and mechanicals always retire the car. */
  retired: boolean
  /** On-track / dangerous → eligible to trigger a caution this lap. */
  cautionWorthy: boolean
  /** Only set when `cautionWorthy`; drives cause-biased flag selection. */
  cautionSeverity: CautionSeverity | null
}

/**
 * Combine a race seed and lap number into a well-distributed 32-bit seed for a
 * per-lap incident PRNG. Style-consistent with the bootstrap's golden-ratio mix
 * (`createPRNG(raceSeed ^ 0x9e3779b9)`). The incident PRNG created from this is
 * fully separate from the main loop rng — load-bearing for determinism.
 */
export function mixSeed(raceSeed: number, lap: number): number {
  let h = (raceSeed ^ 0x9e3779b9) | 0
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) | 0
  h = (h ^ (lap + 1)) | 0 // lap + 1 so lap 0 does not collapse to the seed-only mix
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) | 0
  return (h ^ (h >>> 16)) | 0
}

export interface CrashInput {
  driverId: string
  racecraft: number      // 0-100
  experience: number     // 0-100
  frustration: number    // 0-100 (driver mood.frustration)
  wet: boolean
  circuitRiskFactor: number // multiplier; passed as 1 (neutral) until per-circuit profiles land in IP-4
  config: RaceIncidentConfig
}

/**
 * Crash hazard = base × racecraftFactor × experienceFactor × frustrationFactor
 * × wetFactor × circuitRiskFactor, clamped. Lower racecraft/experience and
 * higher frustration raise it. On a hit the car retires; a draw against
 * `crashMajorShare` decides a heavy shunt (always caution-worthy, `'major'`)
 * vs. a lighter incident (caution-worthy from a draw against `crashCautionShare`,
 * `'minor'`). Draw order is fixed: hazard → [major] → [caution].
 */
export function evaluateCrash(input: CrashInput, rng: PRNG): IncidentRoll | null {
  const { config } = input
  const racecraftFactor = 1.5 - input.racecraft / 100        // 1.5 (rc 0) → 0.5 (rc 100)
  const experienceFactor = 1.3 - (0.6 * input.experience) / 100 // 1.3 (exp 0) → 0.7 (exp 100)
  const frustrationFactor = 1 + (0.5 * input.frustration) / 100 // 1.0 (fr 0) → 1.5 (fr 100)
  const wetFactor = input.wet ? config.wetCrashMultiplier : 1
  let hazard = config.crashBaseHazard * racecraftFactor * experienceFactor * frustrationFactor * wetFactor * input.circuitRiskFactor
  hazard = Math.max(0, Math.min(MAX_INCIDENT_HAZARD, hazard))

  if (!rng.chance(hazard)) return null

  if (rng.chance(config.crashMajorShare)) {
    return { driverId: input.driverId, kind: 'crash', retired: true, cautionWorthy: true, cautionSeverity: 'major' }
  }
  const cautionWorthy = rng.chance(config.crashCautionShare)
  return { driverId: input.driverId, kind: 'crash', retired: true, cautionWorthy, cautionSeverity: cautionWorthy ? 'minor' : null }
}

export interface MechanicalInput {
  driverId: string
  reliability: number  // car.reliability 0-100
  lapFraction: number  // currentLap / totalLaps, 0-1
  config: RaceIncidentConfig
}

/**
 * Mechanical hazard = base × reliabilityFactor × (1 + lapFraction × wearFactor),
 * clamped. Lower `reliability` and later laps raise it. On a hit the car
 * retires; `cautionWorthy` comes from a draw against `mechanicalCautionShare`
 * and is always `'minor'` (a stopped car → yellow/VSC, never a heavy-shunt SC).
 */
export function evaluateMechanical(input: MechanicalInput, rng: PRNG): IncidentRoll | null {
  const { config } = input
  const reliabilityFactor = 1.5 - input.reliability / 100 // 1.5 (rel 0) → 0.5 (rel 100)
  const lapFraction = Math.max(0, Math.min(1, input.lapFraction))
  const wearTerm = 1 + lapFraction * MECHANICAL_WEAR_FACTOR
  let hazard = config.mechanicalBaseHazard * reliabilityFactor * wearTerm
  hazard = Math.max(0, Math.min(MAX_INCIDENT_HAZARD, hazard))

  if (!rng.chance(hazard)) return null

  const cautionWorthy = rng.chance(config.mechanicalCautionShare)
  return { driverId: input.driverId, kind: 'mechanical', retired: true, cautionWorthy, cautionSeverity: cautionWorthy ? 'minor' : null }
}

export interface RaceIncidentDriver {
  id: string
  racecraft: number
  experience: number
  frustration: number
  reliability: number
}

export interface RollLapIncidentsInput {
  drivers: RaceIncidentDriver[]
  dnfDriverIds: Record<string, true>
  currentLap: number
  totalLaps: number
  wet: boolean
  circuitRiskFactor: number
  config: RaceIncidentConfig
}

/**
 * Roll crash then mechanical for every non-retired driver, iterated in sorted
 * id order for deterministic PRNG consumption. Both detectors run for every
 * eligible car (predictable per-car draw structure); a crash retirement takes
 * precedence over a same-lap mechanical so a car is never double-retired.
 */
export function rollLapIncidents(input: RollLapIncidentsInput, rng: PRNG): IncidentRoll[] {
  const out: IncidentRoll[] = []
  const lapFraction = input.totalLaps > 0 ? input.currentLap / input.totalLaps : 0
  const sorted = [...input.drivers].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  for (const d of sorted) {
    if (input.dnfDriverIds[d.id]) continue
    const crash = evaluateCrash(
      { driverId: d.id, racecraft: d.racecraft, experience: d.experience, frustration: d.frustration, wet: input.wet, circuitRiskFactor: input.circuitRiskFactor, config: input.config },
      rng,
    )
    const mechanical = evaluateMechanical(
      { driverId: d.id, reliability: d.reliability, lapFraction, config: input.config },
      rng,
    )
    if (crash) out.push(crash)
    else if (mechanical) out.push(mechanical)
  }
  return out
}

/**
 * Worst caution severity this lap (major dominates), or null when no roll is
 * caution-worthy. The simulator OR's this with the rejoin contribution.
 */
export function cautionFromIncidents(rolls: IncidentRoll[]): CautionSeverity | null {
  const worthy = rolls.filter((r) => r.cautionWorthy)
  if (worthy.length === 0) return null
  return worthy.some((r) => r.cautionSeverity === 'major') ? 'major' : 'minor'
}
