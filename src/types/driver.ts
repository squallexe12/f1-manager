import type { OffenceType } from '@/types/race'

export interface DriverAttributes {
  pace: number          // 0-100
  racecraft: number     // 0-100
  experience: number    // 0-100
  mentality: number     // 0-100
  marketability: number // 0-100
  developmentPotential: number // 0-100
}

export interface Mood {
  motivation: number   // 0-100
  frustration: number  // 0-100
  confidence: number   // 0-100
}

export interface Contract {
  salary: number
  /**
   * Seasons remaining until contract end (relative). The absolute end
   * season is `currentSeason + termEndSeason - 1`. Decrements at season
   * end via `processSeasonEnd`. A value of 1 means contract expires at
   * end of current season ("EOS").
   */
  termEndSeason: number
  performanceBonuses: { condition: string; value: number }[]
  releaseClause: number | null
}

export interface Rivalry {
  targetDriverId: string
  intensity: number // 0-100
  cause: string
}

export interface SeasonStats {
  points: number
  wins: number
  podiums: number
  poles: number
  dnfs: number
  /**
   * Count of race-time sanctions issued to this driver this season that
   * actually cost lap time. Incremented by 1 per `AppliedPenalty` whose
   * `timePenaltySeconds > 0` (5s, 10s, drive-through, stop-go). Reprimands,
   * fines, and penalty-points-only sanctions are NOT counted here — they
   * are tracked via `Driver.penaltyPoints` and `Driver.warningsThisSeason`.
   * Folded in by `processPostRace` in `src/engine/core/post-race-processor.ts`.
   */
  penalties: number
  bestFinish: number
  averageFinish: number
  /**
   * Last race round number whose result was folded into this driver's
   * season stats. Guards `processPostRace()` against double-counting when
   * the worker's race-end event fires more than once in a single race
   * (dev-mode re-mount, stale adapter callbacks, strict-mode effect
   * replay). `0` means "no round processed yet this season".
   */
  lastProcessedRound: number
}

export interface PenaltyPointEntry {
  points: number
  issuedSeason: number
  issuedRound: number
  offenceType: OffenceType
  raceId: string
}

export interface DriverPulse {
  /** Short status, target ≤ 32 chars. Empty string before first init. */
  headline: string
  /** Factual one-liner assembled from current-season state. Empty string before first init. */
  detail: string
}

export type ScoutSignal = 'hot' | 'tracking' | 'available'

export interface Driver {
  id: string
  firstName: string
  lastName: string
  shortName: string // 3-letter abbreviation 
  nationality: string
  age: number
  teamId: string | null
  attributes: DriverAttributes
  mood: Mood
  contract: Contract | null
  seasonStats: SeasonStats
  rivalries: Rivalry[]
  peakAge: number
  declineRate: number
  isReserve: boolean
  isF2: boolean
  /**
   * Rolling history of finishing positions for the most recent rounds of the
   * current season. Ordered oldest → newest, capped at FORM_WINDOW entries
   * (see `src/engine/drivers/form-history.ts`). DNF is recorded as 21 so the
   * series stays numeric; UI renders it as "DNF".
   */
  form: number[]
  /** Finish position of the driver's most recent completed race, or null. */
  lastRaceResult: number | null
  /**
   * Active super-licence penalty-point entries on a rolling 22-round window.
   * Each entry expires individually (currentSeason - issuedSeason) * 22 +
   * (currentRound - issuedRound) >= 22 rounds after issue. Default: empty.
   */
  penaltyPoints: PenaltyPointEntry[]
  /**
   * Driving-warnings counter for the current season. Resets at season end and
   * on threshold consumption (5 → triggers 10-place grid drop). Default: 0.
   */
  warningsThisSeason: number
  /**
   * One-shot grid-position drop applied at the next race after qualifying.
   * Consumed and zeroed by the bootstrap grid-drop step. Default: 0.
   */
  nextRaceGridDrop: number
  /**
   * If set, the driver is suspended through this round inclusive and is
   * substituted by the reserve in `applyBanSubstitution`. Cleared at the
   * start of post-race processing for the round equal to this value.
   */
  banUntilRound: number | null
  /**
   * Running total of career race wins across all seasons. Incremented by
   * `applyRaceCareerDeltas` in `processPostRace` when finishing P1.
   * Pre-seeded from real-world EOS-2025 values for the 2026 grid; existing
   * saves default to 0 via the v12→v13 migration.
   */
  careerWins: number
  /** Career podiums (P1–P3). See `careerWins` for accumulation model. */
  careerPodiums: number
  /** Career race starts (every finished or DNF'd race counts). */
  careerStarts: number
  /**
   * Drivers' Championship titles won. Incremented by
   * `applySeasonEndCareerDeltas` when this driver finishes P1 in the final
   * standings.
   */
  worldTitles: number
  /**
   * Per-driver narrative status, regenerated each round and on game init by
   * `derivePulse`. See `src/engine/drivers/pulse.ts` for the 13-branch table.
   */
  pulse: DriverPulse
  /**
   * Optional URL to a driver portrait image. Null = render the stripe SVG
   * placeholder. UI is responsible for image hosting; engine treats this as
   * an opaque string.
   */
  portraitUrl: string | null
  /**
   * Scout pool signal — derived from observable state by `computeScoutSignal`.
   * Semantically meaningful when teamId === null OR isF2; computed for every
   * driver so the field is always populated.
   */
  scoutSignal: ScoutSignal
  /**
   * Count of player-filed scouting reports on this driver. Persists across
   * seasons. High counts upgrade `scoutSignal` per `computeScoutSignal`.
   * Incremented only via the `fileScoutingReport` store action.
   */
  scoutingReports: number
}
