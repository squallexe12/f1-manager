import type { FullGameState } from '@/engine/core/state-manager'
import type { Race } from '@/types/race'

/** Narrowest world-slice the brief actually needs. */
export type RaceBriefWorld = Pick<FullGameState, 'gameState' | 'calendar'>

/**
 * Session identifier shown on the Paddock "Next race" card. The order here
 * matches how the UI renders session chips left → right.
 */
export type RaceSessionKey = 'FP1' | 'FP2' | 'FP3' | 'SQ' | 'SPRINT' | 'QUAL' | 'RACE'

export interface RaceSessionSlot {
  key: RaceSessionKey
  /** Display string like "FRI 13:30" used verbatim by the UI. */
  label: string
}

export interface NextRaceWeather {
  /** Degrees Celsius. Rounded integer. */
  airTemp: number
  /** Degrees Celsius. Rounded integer. */
  trackTemp: number
  /** Percentage 0-100. Rounded integer. */
  rainChance: number
}

export interface NextRaceBrief {
  round: number
  totalRounds: number
  race: Race
  /**
   * Rounds remaining until this race (includes the race itself). Stable
   * proxy for "days out" because the calendar is not calendar-dated in the
   * current data model — each round advances 14 game-days.
   */
  daysOut: number
  /** Scheduled sessions for this weekend (sprint weekends include sprint chips). */
  sessions: RaceSessionSlot[]
  weather: NextRaceWeather
}

/**
 * Days-per-round heuristic. Two-week gap between races matches the typical
 * F1 season cadence and keeps the Paddock countdown meaningful without
 * requiring real calendar dates on every race in the data file.
 */
const DAYS_PER_ROUND = 14

const STANDARD_SESSIONS: RaceSessionSlot[] = [
  { key: 'FP1', label: 'FRI 13:30' },
  { key: 'FP2', label: 'FRI 17:00' },
  { key: 'FP3', label: 'SAT 12:30' },
  { key: 'QUAL', label: 'SAT 16:00' },
  { key: 'RACE', label: 'SUN 15:00' },
]

const SPRINT_SESSIONS: RaceSessionSlot[] = [
  { key: 'FP1', label: 'FRI 12:30' },
  { key: 'SQ', label: 'FRI 16:30' },
  { key: 'SPRINT', label: 'SAT 12:00' },
  { key: 'QUAL', label: 'SAT 16:00' },
  { key: 'RACE', label: 'SUN 15:00' },
]

/**
 * Rough baseline weather by circuit downforce level / geography. Deterministic
 * and derived from circuit metadata alone — the Paddock brief is a pre-race
 * preview, so it does not call the race-time Weather engine.
 */
function forecastWeather(race: Race): NextRaceWeather {
  const { circuit } = race
  const rainBase =
    circuit.weatherVariability === 'high' ? 35 :
    circuit.weatherVariability === 'medium' ? 15 : 5
  const airBase =
    circuit.downforceLevel === 'high' ? 22 :
    circuit.downforceLevel === 'low' ? 28 : 25
  const trackBase = airBase + 12
  return {
    airTemp: airBase,
    trackTemp: trackBase,
    rainChance: rainBase,
  }
}

/**
 * Build the Paddock "Next race" card payload from the world state. Returns
 * null when the schedule is exhausted (season-end phase).
 */
export function getNextRaceBrief(world: RaceBriefWorld): NextRaceBrief | null {
  const { gameState, calendar } = world
  const race = calendar[gameState.currentRound - 1]
  if (!race) return null

  const sessions = race.isSprint ? SPRINT_SESSIONS : STANDARD_SESSIONS

  return {
    round: race.round,
    totalRounds: gameState.totalRaces,
    race,
    daysOut: DAYS_PER_ROUND,
    sessions,
    weather: forecastWeather(race),
  }
}
