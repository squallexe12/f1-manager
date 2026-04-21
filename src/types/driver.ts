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
}
