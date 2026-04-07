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
  dnfs: number
  penalties: number
  bestFinish: number
  averageFinish: number
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
}
