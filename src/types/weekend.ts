import type { TireCompound, WeatherState } from '@/types/race'

/**
 * Canonical practice + qualifying weekend state (plan §2.1). This is the ONLY
 * home for these types and the ONLY persisted bundle for the feature. It hangs
 * off `FullGameState.weekendState` (flat — there is no nested `world` object at
 * the engine layer; in the store, `world.weekendState` === this).
 *
 * Every field is a plain object / primitive / array — JSON-serializable, with
 * no `Date` / `Map` / `Set` / class instances, per the persistence contract.
 */

// ── Tire ledger (weekend-wide, persisted) ───────────────────────────────────
/** Sets remaining per compound, keyed by canonical TireCompound (C1..C5). */
export interface WeekendTireLedger {
  remaining: Partial<Record<TireCompound, number>> // e.g. { C3: 2, C4: 3, C5: 4 }
}

// ── Practice ────────────────────────────────────────────────────────────────
export type PracticeProgram = 'race-pace' | 'qualifying-sim' | 'tire-test' | 'setup-work'

/** Per-driver accumulated setup state for the current weekend. Persisted. */
export interface DriverWeekendSetup {
  driverId: string
  setupConfidence: number // 0..100, accumulated across FP sessions
  tireDegRead: number // 0..100, accumulated across FP sessions
  sessionsCompleted: number
}

export interface PracticeDriverResult {
  driverId: string
  program: PracticeProgram | null // null = idled / skipped
  setupConfidenceDelta: number // 0..100 delta this session
  tireDegReadDelta: number // 0..100 delta this session
  lapsCompleted: number
  setsConsumed: Partial<Record<TireCompound, number>>
  sessionAborted: boolean
}

export interface PracticeSessionResult {
  sessionIndex: 0 | 1 | 2 // FP1/FP2/FP3 (sprint uses 0 only)
  programByDriver: Record<string, PracticeProgram> // player drivers only
  driverResults: PracticeDriverResult[]
  completedAt: string // ISO string — cosmetic only, never fed to PRNG
}

// ── Qualifying ──────────────────────────────────────────────────────────────
export type QualiFormat = 'qualifying' | 'sprint-qualifying'
export type QualiSegment = 'Q1' | 'Q2' | 'Q3' | 'SQ1' | 'SQ2' | 'SQ3'

export interface QualiAttempt {
  driverId: string
  compound: TireCompound
  lapTime: number | null // seconds; null = no time set
  sector1: number | null
  sector2: number | null
  sector3: number | null
  aborted: boolean
  lapDeleted: boolean // track-limits; always false in MVP (ADR-PQ-003)
}

export interface QualiDriverResult {
  driverId: string
  bestLapTime: number | null
  attempts: QualiAttempt[]
  eliminated: boolean
  segmentPosition: number // 1-based within the segment
}

export interface QualiSegmentResult {
  segment: QualiSegment
  weather: WeatherState // sampled once at segment start
  results: QualiDriverResult[] // sorted by segmentPosition
  advancing: string[]
  eliminated: string[]
}

/** Final classification for one session. Persisted. */
export interface QualifyingResult {
  format: QualiFormat
  round: number // integrity check on read
  segments: QualiSegmentResult[] // [Q1/SQ1, Q2/SQ2, Q3/SQ3]
  gridOrder: string[] // P1..PN driverIds, pre-penalties
  bestTimes: Record<string, number | null>
  pole: { driverId: string; time: number | null } // for seasonStats.poles
  fastestLap: { driverId: string; time: number } | null
  seed: number // determinism audit/replay
}

// ── The single persisted bundle ─────────────────────────────────────────────
export interface WeekendState {
  round: number
  season: number
  tireLedger: WeekendTireLedger
  driverSetup: Record<string, DriverWeekendSetup> // all drivers (AI = neutral 50/50)
  practiceResults: PracticeSessionResult[] // FP sessions completed this weekend
  qualifyingResult: QualifyingResult | null // Q / race grid source of truth
  sprintQualifyingResult: QualifyingResult | null // SQ / sprint grid source of truth
}

export function createEmptyWeekendState(round: number, season: number): WeekendState {
  return {
    round,
    season,
    tireLedger: { remaining: {} },
    driverSetup: {},
    practiceResults: [],
    qualifyingResult: null,
    sprintQualifyingResult: null,
  }
}
