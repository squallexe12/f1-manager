export type TireCompound = 'C1' | 'C2' | 'C3' | 'C4' | 'C5'
export type TireLabel = 'hard' | 'medium' | 'soft'
export type WeatherState = 'dry' | 'damp' | 'wet'
export type DriverCommand = 'push' | 'standard' | 'conserve' | 'overtake' | 'defend' | 'pit'

export interface Circuit {
  id: string
  name: string
  country: string
  laps: number
  downforceLevel: 'low' | 'medium' | 'high'
  tireWear: 'low' | 'medium' | 'high'
  overtakingDifficulty: 'low' | 'medium' | 'high'
  weatherVariability: 'low' | 'medium' | 'high'
  sectorCount: number
  compounds: [TireCompound, TireCompound, TireCompound] // selected by Pirelli
}

export interface Race {
  id: string
  name: string
  circuit: Circuit
  round: number
  isSprint: boolean
}

export interface TireState {
  compound: TireCompound
  label: TireLabel
  wear: number // 0-100 (100 = new)
  lapsFitted: number
}

export interface LapResult {
  lap: number
  driverId: string
  lapTime: number
  sector1: number
  sector2: number
  sector3: number
  position: number
  gapToLeader: number
  gapToAhead: number
  tire: TireState
  pitted: boolean
}

export interface RaceStrategy {
  driverId: string
  plannedStops: { lap: number; compound: TireCompound }[]
  currentCommand: DriverCommand
}

export interface StrategyOption {
  type: 'undercut' | 'optimum' | 'overcut'
  pitLap: number
  newCompound: TireCompound  
  projectedOutcome: string
  probability: number // chance of gaining position
  risk: string
}

export interface BattleForecast {
  attackerId: string
  defenderId: string
  overtakeProbability: number
  estimatedLaps: number
  description: string
}

export interface WeatherForecast {
  current: WeatherState
  rainProbability: number
  changeInLaps: number | null
}

export interface RaceState {
  currentLap: number
  totalLaps: number
  weather: WeatherForecast
  safetyCar: 'green' | 'vsc' | 'sc'
  trackTemp: number
  results: LapResult[][]  // [lap][driver]
  incidents: RaceIncident[]
  commentary: CommentaryEntry[]
}

export interface RaceIncident {
  lap: number
  type: 'crash' | 'mechanical' | 'penalty' | 'safety-car' | 'weather-change'
  driverIds: string[]
  description: string
}

export interface CommentaryEntry {
  lap: number
  text: string
  severity: 'critical' | 'highlight' | 'radio' | 'info' | 'neutral'
}

export type SimSpeed = 1 | 2 | 5 | 'max'

export type WorkerInMessage =
  | { type: 'start'; raceState: RaceState; strategies: RaceStrategy[]; seed: number }
  | { type: 'setSpeed'; speed: SimSpeed }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'command'; driverId: string; command: DriverCommand }
  | { type: 'strategyChange'; driverId: string; strategy: RaceStrategy }

export type WorkerOutMessage =
  | { type: 'lapUpdate'; lap: number; results: LapResult[]; tireStates: Record<string, TireState>; weather: WeatherForecast; safetyCar: string }
  | { type: 'commentary'; entries: CommentaryEntry[] }
  | { type: 'incident'; incident: RaceIncident }
  | { type: 'raceEnd'; finalResults: LapResult[]; fastestLap: { driverId: string; time: number } }
