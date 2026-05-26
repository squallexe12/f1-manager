import type {
  OffenceType,
  RaceIncident,
  SeverityTier,
} from '@/types/race'
import type { PitLaneCalibration } from '@/types/calibration'
import type { PitLaneCarState } from '@/types/pit-lane'
import type { PRNG } from '@/engine/core/prng'
import { sampleGaussian } from '@/engine/core/gaussian'
import type { PenaltyCalibration } from '@/data/penalty-calibration'
import { severityFromScore } from './penalty-engine'
import { tickPitLaneFsm, type PitLaneFsmContext } from './pit-lane-fsm'
import { evaluatePitLineCrossing, DEFAULT_PIT_LINE_CONFIG } from './pit-line-crossing'

/**
 * Tier B v2 pit-lane sub-step engine. `simulatePitLane` runs a deterministic
 * second-resolution sub-simulation for one main-loop lap when ≥1 car enters
 * the pit lane on that lap. Returns:
 *   - per-driver added lap-time seconds (drop-in replacement for the static
 *     `pitLoss.meanLossSeconds` term in the existing race-simulator pit branch)
 *   - investigation-opened incidents for any unsafe-release / speeding events
 *   - informational pit-lane events (entry / release / exit / speeding-detected)
 *     surfaced as commentary by the worker adapter
 *
 * Determinism contract (spec §5.3, refined for IP-B1):
 *   Cars are sorted ASC by `driverId` before the simulation begins. Per car,
 *   PRNG values are consumed in this fixed order:
 *     1. entryDecelNoise     (1 sample, rng.next())
 *     2. serviceTimeNoise    (1 sample, sampleGaussian(rng))
 *     3. limitDriftSample    (1 sample, sampleGaussian(rng) — single value held
 *                             constant across the entire limit-zone transit so
 *                             "speeding" is a per-stop coin flip, not a per-tick
 *                             gauntlet that fires on any of ~120 sub-ticks)
 *     4. releaseTimingNoise  (1 sample, rng.next())
 *     5. exitAccelNoise      (1 sample, rng.next())
 *     6. pitLineEntryCrossing (1 sample, rng.chance — Tier C IP-C5)
 *     7. pitLineExitCrossing  (1 sample, rng.chance — Tier C IP-C5)
 *
 * Items 1, 4, 5 are currently unused — they burn PRNG values for forward
 * compatibility so future additions can consume them without re-baselining
 * existing seeded races.
 *
 * Items 6, 7 (Tier C) are APPENDED at the END of each car's draw order. They
 * are evaluated immediately after exitAccelNoise so the white-line detector
 * never shifts the existing Tier B sub-step PRNG ordering — the pit-lane
 * determinism HARD GATE stays byte-identical. On a crossing the engine emits an
 * automatic `penalty-issued` incident (offence `pit-line-crossing`, no
 * investigation) that the race-simulator merges into appliedPenaltiesByDriver +
 * pendingTimePenalties via the same path it uses for resolved investigations.
 */

const SUB_STEP_DT = 0.1 // seconds per FSM tick
const SAFETY_MARGIN_SECONDS = 0.5 // unsafe-release threshold
const SPEEDING_TOLERANCE_KPH = 0.5 // FIA tolerance over the limit
const SERVICE_BASE_SECONDS = 2.5
const SERVICE_NOISE_SCALE = 0.3

// ─── Inputs / Outputs ─────────────────────────────────────────────────────────

export interface PitLaneSimCarInput {
  driverId: string
  carEntrySpeedKph: number
  carExitSpeedKph: number
  releaseRating: number          // 0-100, modulates unsafe-release fault
  speedDisciplineRating: number  // 0-100, modulates speed-drift mean
  serviceTimeRating: number      // 0-100, modulates service duration
  driverRacecraft: number        // 0-100
  driverExperience: number       // 0-100
}

export interface PitLaneSimInput {
  cars: PitLaneSimCarInput[]
  pitLane: PitLaneCalibration
  /** Existing OpenF1-derived per-circuit pit-loss mean (seconds added to lap time). */
  pitLossMean: number
  pitLossStddev: number
  calibration: PenaltyCalibration
}

export type PitLaneEvent =
  | { type: 'pitLaneEntry'; driverId: string; entrySpeedKph: number }
  | { type: 'pitLaneRelease'; driverId: string; releaseDelaySeconds: number }
  | { type: 'pitLaneExit'; driverId: string; totalLaneSeconds: number }
  | { type: 'pitLaneSpeedingDetected'; driverId: string; sampledSpeedKph: number }

export interface PitLaneSimResult {
  /** Added lap-time seconds per driver, drop-in for the static `pitLoss.meanLossSeconds` term. */
  addedLapTime: Record<string, number>
  /** FSM-derived total lane time per driver (decel + transit + service + accel), informational. */
  timings: Record<string, number>
  incidents: RaceIncident[]
  events: PitLaneEvent[]
}

// ─── Unsafe-release fault evaluation ──────────────────────────────────────────

export interface UnsafeReleaseInput {
  releasedCar: PitLaneCarState
  potentiallyConflictingCars: PitLaneCarState[]
  releasedCrewRelease: number     // 0-100
  releasedDriverRacecraft: number // 0-100
  /** Distance from the released car to the closest car behind it that could collide. */
  conflictingDistanceMeters: number
  /** Closing speed at which the conflict approaches, km/h. */
  conflictingClosingSpeedKph: number
  calibration: PenaltyCalibration
}

export interface UnsafeReleaseEvaluation {
  fault: number
  decision: null | { driverId: string; severity: SeverityTier; offenceType: OffenceType }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

export function evaluateUnsafeRelease(input: UnsafeReleaseInput): UnsafeReleaseEvaluation {
  const closingMps = Math.max(0.1, input.conflictingClosingSpeedKph / 3.6)
  const timeToReachSeconds = input.conflictingDistanceMeters / closingMps
  const gapPenalty =
    timeToReachSeconds < SAFETY_MARGIN_SECONDS
      ? (SAFETY_MARGIN_SECONDS - timeToReachSeconds) / SAFETY_MARGIN_SECONDS
      : 0
  const crewPenalty = (100 - input.releasedCrewRelease) / 200
  const driverPenalty = (100 - input.releasedDriverRacecraft) / 400

  const fault = clamp01(gapPenalty + crewPenalty + driverPenalty)

  if (input.potentiallyConflictingCars.length === 0) {
    return { fault, decision: null }
  }
  if (fault < input.calibration.unsafeReleaseFaultThreshold) {
    return { fault, decision: null }
  }
  const severity = severityFromScore(
    fault,
    input.calibration.unsafeReleaseFaultThreshold,
    input.calibration.severityBands,
  )
  return {
    fault,
    decision: {
      driverId: input.releasedCar.driverId,
      severity,
      offenceType: 'unsafe-release',
    },
  }
}

// ─── Pit-lane speeding detection ──────────────────────────────────────────────

export interface PitLaneSpeedingInput {
  driverId: string
  sampledSpeedKph: number
  speedLimitKph: number
  speedDiscipline: number
  driverExperience: number
}

export interface PitLaneSpeedingEvaluation {
  decision: null | { driverId: string; severity: SeverityTier; offenceType: OffenceType }
}

export function evaluatePitLaneSpeeding(input: PitLaneSpeedingInput): PitLaneSpeedingEvaluation {
  if (input.sampledSpeedKph <= input.speedLimitKph + SPEEDING_TOLERANCE_KPH) {
    return { decision: null }
  }
  return {
    decision: {
      driverId: input.driverId,
      severity: 'minor',
      offenceType: 'pit-lane-speeding',
    },
  }
}

// ─── Sub-step orchestrator ────────────────────────────────────────────────────

function ratingMod(rating: number): number {
  return Math.max(0.5, Math.min(1.5, 1 - (rating - 70) / 100))
}

function deriveServiceDuration(rating: number, gaussianSample: number): number {
  return Math.max(0.8, SERVICE_BASE_SECONDS * ratingMod(rating) + gaussianSample * SERVICE_NOISE_SCALE)
}

function deriveAddedLapTime(rating: number, mean: number, stddev: number, gaussianSample: number): number {
  return Math.max(0.5, mean * ratingMod(rating) + gaussianSample * stddev)
}

/**
 * Speed-drift sampler. Mean offset = `pitLaneSpeedingMeanOffsetKph` (typically -1
 * km/h below the limit at neutral discipline), stddev shrinks with discipline.
 */
function sampleSpeedDrift(rng: PRNG, speedDiscipline: number, calibration: PenaltyCalibration): number {
  const stddev = (100 - speedDiscipline) / 50
  const z = sampleGaussian(rng)
  return calibration.pitLaneSpeedingMeanOffsetKph + z * stddev
}

export function simulatePitLane(input: PitLaneSimInput, rng: PRNG): PitLaneSimResult {
  const sortedCars = [...input.cars].sort((a, b) => (a.driverId < b.driverId ? -1 : a.driverId > b.driverId ? 1 : 0))

  const addedLapTime: Record<string, number> = {}
  const timings: Record<string, number> = {}
  const incidents: RaceIncident[] = []
  const events: PitLaneEvent[] = []

  // Phase 1: deterministic pre-roll per car (sorted by id). Burns PRNG values
  // in the fixed order (entryDecel → serviceTimeNoise → ... see header comment).
  // Speed-drift samples are drawn lazily inside the FSM tick.
  type PerCar = {
    car: PitLaneSimCarInput
    state: PitLaneCarState
    ctx: PitLaneFsmContext
    serviceDurationSeconds: number
    addedLapTimeSeconds: number
    /** Pre-rolled drift held constant across the limit-zone — see header §5.3. */
    limitDriftKph: number
    speedingFired: boolean
    speedingSampledSpeed: number | null
  }
  const perCar: PerCar[] = []

  for (const car of sortedCars) {
    /* entryDecelNoise — currently unused, burned for ordering stability */
    rng.next()
    const serviceTimeNoise = Math.max(-3, Math.min(3, sampleGaussian(rng)))

    const serviceDurationSeconds = deriveServiceDuration(car.serviceTimeRating, serviceTimeNoise)
    const addedLapTimeSeconds = deriveAddedLapTime(
      car.serviceTimeRating,
      input.pitLossMean,
      input.pitLossStddev,
      serviceTimeNoise,
    )

    /* limitDriftSample — single per-stop draw, governs speeding detection */
    const limitDriftKph = sampleSpeedDrift(rng, car.speedDisciplineRating, input.calibration)

    addedLapTime[car.driverId] = addedLapTimeSeconds
    events.push({ type: 'pitLaneEntry', driverId: car.driverId, entrySpeedKph: car.carEntrySpeedKph })

    perCar.push({
      car,
      state: {
        driverId: car.driverId,
        zone: 'entry-decel',
        enteredAtSeconds: 0,
        zoneEnteredAtSeconds: 0,
        speedKph: car.carEntrySpeedKph,
        positionMeters: 0,
        serviceStartSeconds: null,
        serviceEndSeconds: null,
        releasedAtSeconds: null,
      },
      ctx: {
        pitLane: input.pitLane,
        carEntrySpeedKph: car.carEntrySpeedKph,
        carExitSpeedKph: car.carExitSpeedKph,
        serviceDurationSeconds,
        speedDiscipline: car.speedDisciplineRating,
      },
      serviceDurationSeconds,
      addedLapTimeSeconds,
      limitDriftKph,
      speedingFired: false,
      speedingSampledSpeed: null,
    })
  }

  // Phase 2: tick the FSM through to completion for each car. Per spec §5.3,
  // we process cars in id-sorted order — so each car's full FSM run consumes
  // its PRNG values contiguously, regardless of physical timing in the lane.
  for (const entry of perCar) {
    let t = 0
    let prevReleasedAt = entry.state.releasedAtSeconds
    while (entry.state.zone !== 'exited') {
      // safety cap: ~60 seconds of sub-stepping is more than enough for any
      // realistic pit lane; halts an infinite loop if something goes wrong.
      if (t > 60) break

      const wasInLimitZone = entry.state.zone === 'limit-zone'
      const inService =
        entry.state.serviceEndSeconds !== null && t < entry.state.serviceEndSeconds

      // Sampler returns the pre-rolled drift constant. We also latch the
      // speeding-detection event once per stop on the first post-service
      // limit-zone tick, since the drift is constant across the zone.
      const sampler = (_sampleRng: PRNG): number => {
        if (wasInLimitZone && !inService && !entry.speedingFired) {
          const sampledSpeed = Math.max(0, input.pitLane.speedLimitKph + entry.limitDriftKph)
          if (sampledSpeed > input.pitLane.speedLimitKph + SPEEDING_TOLERANCE_KPH) {
            entry.speedingFired = true
            entry.speedingSampledSpeed = sampledSpeed
          }
        }
        return entry.limitDriftKph
      }

      entry.state = tickPitLaneFsm(entry.state, SUB_STEP_DT, t, entry.ctx, sampler, rng)

      // Detect release transition (serviceEndSeconds → release fired)
      if (prevReleasedAt === null && entry.state.releasedAtSeconds !== null) {
        events.push({
          type: 'pitLaneRelease',
          driverId: entry.car.driverId,
          releaseDelaySeconds: entry.state.releasedAtSeconds,
        })

        // Check unsafe release against any car currently in entry-decel/limit-zone
        // behind the released car. Position-based: a car behind has lower position.
        const releasedPos = entry.state.positionMeters
        const conflicting = perCar
          .filter((other) => other.car.driverId !== entry.car.driverId)
          .filter((other) =>
            (other.state.zone === 'entry-decel' || other.state.zone === 'limit-zone') &&
            other.state.positionMeters < releasedPos &&
            other.state.positionMeters > 0,
          )
          .map((other) => ({ other, gap: releasedPos - other.state.positionMeters }))
          .sort((a, b) => a.gap - b.gap)

        if (conflicting.length > 0) {
          const closest = conflicting[0]
          const closestSpeedKph = closest.other.state.speedKph || input.pitLane.speedLimitKph
          const evaluation = evaluateUnsafeRelease({
            releasedCar: entry.state,
            potentiallyConflictingCars: conflicting.map((c) => c.other.state),
            releasedCrewRelease: entry.car.releaseRating,
            releasedDriverRacecraft: entry.car.driverRacecraft,
            conflictingDistanceMeters: closest.gap,
            conflictingClosingSpeedKph: closestSpeedKph,
            calibration: input.calibration,
          })
          if (evaluation.decision) {
            incidents.push({
              lap: 0, // assigned by caller
              type: 'investigation-opened',
              driverIds: [evaluation.decision.driverId],
              description: `${evaluation.decision.driverId.toUpperCase()} under investigation: ${evaluation.decision.offenceType}`,
              investigationId: '', // assigned by caller via openInvestigation
              offenceType: evaluation.decision.offenceType,
              decideOnLap: 0,
            })
          }
        }
        prevReleasedAt = entry.state.releasedAtSeconds
      }

      t += SUB_STEP_DT
    }
    timings[entry.car.driverId] = t
    events.push({ type: 'pitLaneExit', driverId: entry.car.driverId, totalLaneSeconds: t })

    if (entry.speedingFired && entry.speedingSampledSpeed !== null) {
      const speedingEval = evaluatePitLaneSpeeding({
        driverId: entry.car.driverId,
        sampledSpeedKph: entry.speedingSampledSpeed,
        speedLimitKph: input.pitLane.speedLimitKph,
        speedDiscipline: entry.car.speedDisciplineRating,
        driverExperience: entry.car.driverExperience,
      })
      if (speedingEval.decision) {
        incidents.push({
          lap: 0,
          type: 'investigation-opened',
          driverIds: [speedingEval.decision.driverId],
          description: `${speedingEval.decision.driverId.toUpperCase()} under investigation: ${speedingEval.decision.offenceType}`,
          investigationId: '',
          offenceType: speedingEval.decision.offenceType,
          decideOnLap: 0,
        })
        events.push({
          type: 'pitLaneSpeedingDetected',
          driverId: entry.car.driverId,
          sampledSpeedKph: entry.speedingSampledSpeed,
        })
      }
    }

    /* releaseTimingNoise — currently unused, burned for ordering stability */
    rng.next()
    /* exitAccelNoise — currently unused, burned for ordering stability */
    rng.next()

    // Tier C IP-C5: pit-entry / pit-exit white-line crossing (automatic).
    // APPENDED at the very END of this car's PRNG consumption (after
    // exitAccelNoise) so the white-line draws never shift the existing Tier B
    // sub-step ordering — the pit-lane determinism HARD GATE stays byte-
    // identical. Both boundaries are always rolled (in fixed entry→exit order)
    // so the draw count per car is constant regardless of outcome. On a
    // crossing the engine emits a `penalty-issued` incident with `lap: 0` and
    // an empty `investigationId`; the race-simulator fills in the real lap and
    // the lap-encoded `pl-<lap>-<driverId>-<boundary>` id, mirroring how it
    // finalises the deferred investigation incidents above.
    for (const boundary of ['entry', 'exit'] as const) {
      const crossed = evaluatePitLineCrossing(
        { boundary, experience: entry.car.driverExperience, config: DEFAULT_PIT_LINE_CONFIG },
        rng,
      )
      if (crossed) {
        const cell = input.calibration.sanctionMatrix['pit-line-crossing'].minor
        incidents.push({
          lap: 0, // assigned by caller
          type: 'penalty-issued',
          driverIds: [entry.car.driverId],
          description: `${entry.car.driverId.toUpperCase()} ${cell.sanction} — crossed the pit-${boundary} white line`,
          investigationId: `pl-${boundary}`, // caller prefixes with the real lap + driverId
          sanction: cell.sanction,
          penaltyPointsIssued: cell.penaltyPoints,
          offenceType: 'pit-line-crossing',
        })
      }
    }
  }

  return { addedLapTime, timings, incidents, events }
}

// Re-exports for plan-level convenience
export type { PitLaneCarState }
