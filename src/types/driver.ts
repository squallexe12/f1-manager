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
}
