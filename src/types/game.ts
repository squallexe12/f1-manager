export type Phase =
  | 'management'
  | 'practice'
  | 'sprint-qualifying'
  | 'sprint'
  | 'qualifying'
  | 'race'
  | 'post-race'
  | 'season-end'

export type ScenarioType = 'golden-era' | 'rebuild' | 'newcomer' | 'crisis'

export interface GameState {
  season: number
  currentRound: number
  phase: Phase
  playerTeamId: string
  scenario: ScenarioType
  seed: number
  totalRaces: number
}

export interface SaveSlot {
  id: string
  name: string
  gameState: GameState
  timestamp: number
  schemaVersion: number
}
