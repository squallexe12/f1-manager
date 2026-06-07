import type { CarPerformance } from '@/types/team'
import type { DriverAttributes } from '@/types/driver'
import type { TireCompound } from '@/types/race'
import type {
  DriverWeekendSetup,
  PracticeDriverResult,
  PracticeProgram,
  PracticeSessionResult,
  WeekendTireLedger,
} from '@/types/weekend'
import type { PRNG } from '@/engine/core/prng'
import { createPRNG } from '@/engine/core/prng'
import { deriveRaceSeed } from '@/engine/race/race-bootstrap'
import { deriveSessionSeed } from '@/engine/weekend/seed-derivation'

/**
 * Practice engine (plan §M1). Pure functions only; all randomness flows through a
 * PRNG derived from `deriveSessionSeed`. No browser APIs, no `Math.random`, no
 * mutation of inputs. A practice session resolves a handful of numbers per driver
 * — the "live" feel is a client-side reveal of these pre-computed results (M5).
 */

export const SESSION_TIME_BUDGET_MINS = 60
export const SKIP_SETUP_CONFIDENCE = 35 // 0..100 baseline a player gets if they skip
export const SKIP_TIRE_DEG_READ = 30
export const NEUTRAL_AI_SETUP = 50 // ADR-PQ-004: AI cars use a fixed neutral baseline

/** Time + tire-set cost per program. setup-work is cheapest in sets; tire-test most. */
export const PROGRAM_COSTS: Record<PracticeProgram, { timeMins: number; sets: number }> = {
  'setup-work': { timeMins: 15, sets: 1 },
  'qualifying-sim': { timeMins: 20, sets: 1 },
  'race-pace': { timeMins: 25, sets: 1 },
  'tire-test': { timeMins: 25, sets: 2 },
}

/**
 * Default weekend tire-set allocation, keyed by label and mapped positionally
 * onto the circuit's 3 compounds (ordered hardest → medium → softest). One
 * weekend-wide pool shared by both player drivers, decremented by practice AND
 * qualifying runs. Soft is the MOST plentiful (it is the qualifying tire and is
 * needed across Q1/Q2/Q3 for both cars) — running soft-heavy practice still bites
 * into the qualifying buffer, which is the real weekend trade-off. (NB: the plan's
 * illustrative "soft fewest" note would starve the standard weekend; deviated.)
 * M8's balance harness owns final tuning.
 */
export const DEFAULT_WEEKEND_TIRE_SETS: { hard: number; medium: number; soft: number } = {
  hard: 3, medium: 4, soft: 7,
}

/** Per-session base yield (points toward 100) before exp/car/noise/diminishing. */
export const BASE_YIELDS: Record<PracticeProgram, { confidence: number; tireDeg: number }> = {
  'setup-work': { confidence: 30, tireDeg: 8 },
  'qualifying-sim': { confidence: 22, tireDeg: 10 },
  'race-pace': { confidence: 18, tireDeg: 22 },
  'tire-test': { confidence: 10, tireDeg: 32 },
}

export function defaultDriverSetup(driverId: string): DriverWeekendSetup {
  return { driverId, setupConfidence: SKIP_SETUP_CONFIDENCE, tireDegRead: SKIP_TIRE_DEG_READ, sessionsCompleted: 0 }
}

export function neutralDriverSetup(driverId: string): DriverWeekendSetup {
  return { driverId, setupConfidence: NEUTRAL_AI_SETUP, tireDegRead: NEUTRAL_AI_SETUP, sessionsCompleted: 0 }
}

function carAverage(car: CarPerformance): number {
  return (
    car.downforce + car.straightSpeed + car.reliability +
    car.tireManagement + car.braking + car.cornering
  ) / 6
}

const clamp01to100 = (v: number): number => Math.max(0, Math.min(100, v))

/**
 * Pure. Resolve ONE driver's program run. Consumes EXACTLY 2 PRNG draws on every
 * path (run / idle / abort) so phantom draws on the early-return branches preserve
 * stream parity — a driver's program choice never shifts a later driver's outcome.
 * Does NOT mutate the ledger; it reports `setsConsumed` and the caller decrements.
 */
export function simulateDriverProgram(args: {
  driverId: string
  program: PracticeProgram | null
  car: CarPerformance
  attributes: DriverAttributes
  current: DriverWeekendSetup
  compound: TireCompound
  ledger: WeekendTireLedger
  prng: PRNG
}): PracticeDriverResult {
  const { driverId, program, car, attributes, current, compound, ledger, prng } = args
  // FIXED-DRAW DISCIPLINE: two draws first, before any branch.
  const cDraw = prng.next()
  const tDraw = prng.next()

  const idle: PracticeDriverResult = {
    driverId, program, setupConfidenceDelta: 0, tireDegReadDelta: 0,
    lapsCompleted: 0, setsConsumed: {}, sessionAborted: false,
  }
  if (program === null) return idle

  const cost = PROGRAM_COSTS[program]
  const available = ledger.remaining[compound] ?? 0
  if (available < cost.sets) {
    return { ...idle, sessionAborted: true }
  }

  const expMult = 0.75 + (attributes.experience / 100) * 0.40 // [0.75, 1.15]
  const carMult = 0.90 + (carAverage(car) / 100) * 0.20 // [0.90, 1.10]
  const noiseAmp = 0.20 - (attributes.mentality / 100) * 0.15 // [0.05, 0.20] — calmer driver, less scatter
  const cNoise = (cDraw * 2 - 1) * noiseAmp
  const tNoise = (tDraw * 2 - 1) * noiseAmp
  const base = BASE_YIELDS[program]
  const confDelta = base.confidence * expMult * carMult * (1 + cNoise) * (1 - (current.setupConfidence / 100) * 0.6)
  const tireDelta = base.tireDeg * expMult * carMult * (1 + tNoise) * (1 - (current.tireDegRead / 100) * 0.6)

  return {
    driverId,
    program,
    setupConfidenceDelta: Math.max(0, confDelta),
    tireDegReadDelta: Math.max(0, tireDelta),
    lapsCompleted: Math.round(cost.timeMins / 1.5),
    setsConsumed: { [compound]: cost.sets },
    sessionAborted: false,
  }
}

/** Pure. Merge a session's deltas into accumulated setup, clamped [0,100].
 *  Only real runs (program set AND not aborted) move the needle / count. */
export function applySessionToSetup(
  current: Record<string, DriverWeekendSetup>,
  result: PracticeSessionResult,
): Record<string, DriverWeekendSetup> {
  const next: Record<string, DriverWeekendSetup> = { ...current }
  for (const r of result.driverResults) {
    if (r.program === null || r.sessionAborted) continue
    const prev = next[r.driverId] ?? defaultDriverSetup(r.driverId)
    next[r.driverId] = {
      driverId: r.driverId,
      setupConfidence: clamp01to100(prev.setupConfidence + r.setupConfidenceDelta),
      tireDegRead: clamp01to100(prev.tireDegRead + r.tireDegReadDelta),
      sessionsCompleted: prev.sessionsCompleted + 1,
    }
  }
  return next
}

const SESSION_KEYS = ['FP1', 'FP2', 'FP3'] as const

/** Softest available compound (highest C-index with sets) — default when a player
 *  program is selected without an explicit compound. */
function defaultRunCompound(ledger: WeekendTireLedger): TireCompound {
  const order: TireCompound[] = ['C5', 'C4', 'C3', 'C2', 'C1']
  // Softest compound that still has sets.
  for (const c of order) if ((ledger.remaining[c] ?? 0) > 0) return c
  // None left: return the softest compound PRESENT in the ledger (a real circuit
  // compound, not a foreign one) — the caller's `available < cost.sets` check then
  // aborts the run cleanly. Only a fully-empty ledger (no keys) falls through to C5.
  for (const c of order) if (c in ledger.remaining) return c
  return 'C5'
}

/**
 * Pure. One full FP session. Player drivers run their chosen program (each
 * consuming a fixed 2 draws, in array order, off the FP-salted session stream);
 * AI drivers are left at their neutral baseline (no draws, no accrual, no ledger
 * decrement — ADR-PQ-004). Two player drivers share ONE weekend tire ledger:
 * the second driver sees the first driver's decrement.
 */
export function runPracticeSession(args: {
  sessionIndex: 0 | 1 | 2
  programByDriver: Record<string, PracticeProgram>
  runCompoundByDriver: Record<string, TireCompound>
  drivers: Array<{ id: string; car: CarPerformance; attributes: DriverAttributes; isPlayer: boolean }>
  setup: Record<string, DriverWeekendSetup>
  ledger: WeekendTireLedger
  circuitId: string
  round: number
  season: number
  worldSeed: number
  completedAt: string
}): { result: PracticeSessionResult; nextSetup: Record<string, DriverWeekendSetup>; nextLedger: WeekendTireLedger } {
  const { sessionIndex, programByDriver, runCompoundByDriver, drivers, setup, ledger, round, worldSeed, completedAt } = args
  const perRoundRoot = deriveRaceSeed(worldSeed, round)
  const prng = createPRNG(deriveSessionSeed(perRoundRoot, SESSION_KEYS[sessionIndex]))

  const workingLedger: WeekendTireLedger = { remaining: { ...ledger.remaining } }
  const driverResults: PracticeDriverResult[] = []
  const programByPlayer: Record<string, PracticeProgram> = {}

  for (const d of drivers) {
    if (!d.isPlayer) continue
    const program = programByDriver[d.id] ?? null
    const compound = runCompoundByDriver[d.id] ?? defaultRunCompound(workingLedger)
    const current = setup[d.id] ?? defaultDriverSetup(d.id)
    const r = simulateDriverProgram({
      driverId: d.id, program, car: d.car, attributes: d.attributes, current, compound, ledger: workingLedger, prng,
    })
    if (program !== null) programByPlayer[d.id] = program
    if (!r.sessionAborted && r.program !== null) {
      for (const [c, n] of Object.entries(r.setsConsumed)) {
        // max(0, …) is defence-in-depth: the abort check already guarantees a run
        // never consumes more than is available, so this cannot fire today — but it
        // keeps a negative set count from ever reaching persisted state if a future
        // change weakens that invariant.
        workingLedger.remaining[c as TireCompound] = Math.max(0, (workingLedger.remaining[c as TireCompound] ?? 0) - n)
      }
    }
    driverResults.push(r)
  }

  const result: PracticeSessionResult = {
    sessionIndex,
    programByDriver: programByPlayer,
    driverResults,
    completedAt,
  }
  return { result, nextSetup: applySessionToSetup(setup, result), nextLedger: workingLedger }
}
