import type { CarPerformance } from '@/types/team'
import type { DriverAttributes, Mood } from '@/types/driver'
import type { CalibrationProfile } from '@/types/calibration'

export type TireCompound = 'C1' | 'C2' | 'C3' | 'C4' | 'C5'
export type TireLabel = 'hard' | 'medium' | 'soft'
export type WeatherState = 'dry' | 'damp' | 'wet'
/**
 * Unified race-control caution flag (Tier C). Promotes the formerly 3-state
 * `safetyCar` field. `green` = racing; `yellow` = local caution (no overtaking);
 * `vsc`/`sc` = virtual/full safety car; `red` = session suspended.
 */
export type RaceFlag = 'green' | 'yellow' | 'vsc' | 'sc' | 'red'
export type DriverCommand = 'push' | 'standard' | 'conserve' | 'overtake' | 'defend' | 'pit'

export type OffenceType =
  | 'collision-minor'
  | 'collision-serious'
  | 'forcing-off'
  | 'illegal-defending'
  | 'unsafe-release'
  | 'pit-lane-speeding'
  | 'failure-to-serve'
  | 'track-limits'
  | 'rejoin-collision'

export type SanctionType =
  | 'reprimand'
  | 'fine'
  | '5s'
  | '10s'
  | 'drive-through'
  | 'stop-go'
  | 'grid-drop'

export type SeverityTier = 'minor' | 'serious' | 'major' | 'egregious'

export type RadioCategory =
  | 'box_box'
  | 'box_opposite'
  | 'pit_confirm'
  | 'stay_out'
  | 'overtake_done'
  | 'overtake_failed'
  | 'tire_complaint'
  | 'gap_call'
  | 'push_now'
  | 'manage_tires'
  | 'investigation'
  | 'penalty_5s'
  | 'penalty_drive_through'
  | 'safety_car_deploy'
  | 'safety_car_in'
  | 'rain_incoming'
  | 'fastest_lap'
  | 'final_lap'
  | 'lights_out'
  | 'driver_frustration'

export type RadioSpeaker = 'engineer' | 'driver' | 'fia'

export type RadioTone = 'calm' | 'urgent' | 'angry' | 'flat' | 'celebrate'

export interface AppliedPenalty {
  offenceType: OffenceType
  sanction: SanctionType
  timePenaltySeconds: number
  penaltyPointsIssued: number
  warningCounted: boolean
  raceLap: number
}

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
  /**
   * Expected pit-lane time loss in seconds, sourced from the circuit's
   * PitLossCalibration when available. Undefined when calibration was not
   * supplied to the strategy calculator (fallback path).
   */
  projectedPitLossSec?: number
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
  safetyCar: RaceFlag
  trackTemp: number
  results: LapResult[][]  // [lap][driver]
  incidents: RaceIncident[]
  commentary: CommentaryEntry[]
}

interface RaceIncidentBase {
  lap: number
  driverIds: string[]
  description: string
}

/**
 * Race-time incident emitted by the simulator. Strict discriminated union on
 * `type` — payload fields are only present (and only typed) for the variants
 * that carry them. Reserved variants `crash` / `mechanical` / `safety-car` /
 * `weather-change` are not yet constructed by the simulator but are kept
 * here so future engines can emit them without re-litigating the type.
 */
export type RaceIncident =
  | (RaceIncidentBase & { type: 'crash' })
  | (RaceIncidentBase & { type: 'mechanical' })
  | (RaceIncidentBase & { type: 'safety-car' })
  | (RaceIncidentBase & { type: 'weather-change' })
  | (RaceIncidentBase & {
      type: 'investigation-opened'
      investigationId: string
      offenceType: OffenceType
      decideOnLap: number
    })
  | (RaceIncidentBase & {
      type: 'penalty-issued'
      investigationId: string
      sanction: SanctionType
      penaltyPointsIssued: number
      offenceType: OffenceType
    })
  | (RaceIncidentBase & {
      type: 'investigation-closed'
      investigationId: string
    })

export interface CommentaryEntry {
  lap: number
  text: string
  severity: 'critical' | 'highlight' | 'radio' | 'info' | 'neutral'
  // Optional radio metadata. All fields additive; old commentary entries
  // (overtakes pre-radio-rewrite, fastest-lap markers, neutral lap-by-lap)
  // remain valid.
  speaker?: RadioSpeaker
  driverId?: string
  teamId?: string
  category?: RadioCategory
  tone?: RadioTone
  isPlayerTeam?: boolean
}

export type SimSpeed = 1 | 2 | 5 | 'max'

export type RaceCommandType = 'setCommand' | 'pit' | 'strategyChange'

export interface SetCommandPayload {
  command: DriverCommand
}

export interface PitCommandPayload {
  compound: TireCompound
}

export interface StrategyChangePayload {
  strategy: RaceStrategy
}

export type RaceCommand =
  | { type: 'setCommand'; driverId: string; payload: SetCommandPayload }
  | { type: 'pit'; driverId: string; payload: PitCommandPayload }
  | { type: 'strategyChange'; driverId: string; payload: StrategyChangePayload }

export type RaceCommandEnvelope =
  | { type: 'setCommand'; driverId: string; payload: SetCommandPayload; timestamp: number; sequence: number }
  | { type: 'pit'; driverId: string; payload: PitCommandPayload; timestamp: number; sequence: number }
  | { type: 'strategyChange'; driverId: string; payload: StrategyChangePayload; timestamp: number; sequence: number }

export type RaceCommandPayload = SetCommandPayload | PitCommandPayload | StrategyChangePayload

// -----------------------------------------------------------------------------
// Race bootstrap inputs (canonical, JSON-serializable)
// Shared with the worker `start` payload via strict superset extension.
// -----------------------------------------------------------------------------

export interface BootstrapDriverInput {
  id: string
  teamId: string
  /**
   * 3-letter abbreviation (e.g. 'NOR', 'VER'). Plumbed through to RaceDriver
   * so the team-radio token resolver can stamp speaker names without rounding
   * back through the `world.drivers` lookup at every emit site.
   */
  shortName: string
  attributes: DriverAttributes
  /**
   * Driver mood at race start. Drives in-race fault probability via the
   * frustration term in `evaluateContestedEvent`. Required since IP-09
   * mood-pipe wiring; transient race state (does not feed back to world).
   */
  mood: Mood
  car: CarPerformance
  teamColor?: string
}

export interface BootstrapStrategyInput {
  driverId: string
  stops: { lap: number; compound: TireCompound }[]
  startCompound?: TireCompound
}

export interface RaceBootstrapInput {
  seed: number
  round: number
  circuit: Circuit
  isSprint: boolean
  drivers: BootstrapDriverInput[]
  strategies?: BootstrapStrategyInput[]
  /**
   * Optional per-circuit calibration profile. When omitted, the bootstrap
   * resolves a profile from the OpenF1 registry or derives a fallback from
   * the circuit's legacy string enums. Exposed on the input so callers
   * (tests, deterministic replays) can inject a known profile.
   */
  calibration?: CalibrationProfile
}

// -----------------------------------------------------------------------------
// Worker protocol (IP-03)
// -----------------------------------------------------------------------------

export type WorkerErrorCode =
  | 'start/invalid-payload'
  | 'start/missing-drivers'
  | 'command/unknown-driver'
  | 'command/invalid-envelope'
  | 'runtime/simulation-failure'

export interface WorkerErrorRecovery {
  canRetry: boolean
  lastValidLap: number
}

/**
 * Worker `start` payload.
 * Strict superset of {@link RaceBootstrapInput}: every field of the bootstrap
 * input is present verbatim, plus worker-only fields that do not belong in the
 * pure bootstrap shape.
 */
export type RaceWorkerStartPayload = RaceBootstrapInput & {
  /** Optional initial simulation speed (defaults to 1× on the worker). */
  simSpeed?: SimSpeed
  /**
   * Player metadata for the team-radio system. The simulator threads these
   * through `SimRaceState` so radio emit sites can stamp `isPlayerTeam` and
   * curate player vs. rival commentary without round-tripping to the store.
   * All optional — empty/undefined keeps radio behaviour neutral.
   */
  playerTeamId?: string
  playerDriverIds?: readonly string[]
  championshipRivalIds?: readonly string[]
  /**
   * Tier B v2 — per-team pit-crew snapshot for engine reads. Populated from
   * `team.pitCrewChief` + `team.pitCrewMembers` at race-start. Empty / absent
   * teams aggregate to the 70/70/70 default-quality baseline.
   */
  teamCrews?: Record<string, {
    chief: import('./staff').PitCrewChief | null
    members: import('./staff').PitCrewMember[]
  }>
}

export type WorkerInMessage =
  | { type: 'start'; payload: RaceWorkerStartPayload }
  | { type: 'setSpeed'; speed: SimSpeed }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'command'; envelope: RaceCommandEnvelope }

/**
 * Atomic (non-container) worker output messages.
 * A `batch` message carries an array of these; batch itself is never nested.
 */
export type WorkerOutEvent =
  | { type: 'ready'; lap: number; totalLaps: number }
  | {
      type: 'lapUpdate'
      lap: number
      results: LapResult[]
      tireStates: Record<string, TireState>
      weather: WeatherForecast
      safetyCar: RaceState['safetyCar']
      trackLimitStrikes: Record<string, number>
    }
  | { type: 'commentary'; entries: CommentaryEntry[] }
  | { type: 'incident'; incident: RaceIncident }
  // Tier B v2 — informational pit-lane events. Drive commentary on the main
  // thread; not authoritative on race outcomes (penalty channel stays the
  // existing 'incident' event with `investigation-opened` / `penalty-issued`
  // payload). All four are emitted from `simulatePitLane` per pit stop.
  | { type: 'pitLaneEntry'; lap: number; driverId: string; entrySpeedKph: number }
  | { type: 'pitLaneRelease'; lap: number; driverId: string; releaseDelaySeconds: number }
  | { type: 'pitLaneExit'; lap: number; driverId: string; totalLaneSeconds: number }
  | { type: 'pitLaneSpeedingDetected'; lap: number; driverId: string; sampledSpeedKph: number }
  | {
      type: 'raceEnd'
      finalResults: LapResult[]
      fastestLap: { driverId: string; time: number }
      appliedPenaltiesByDriver: Record<string, AppliedPenalty[]>
    }
  | {
      type: 'error'
      code: WorkerErrorCode
      message: string
      fatal: boolean
      recovery?: WorkerErrorRecovery
    }

export type WorkerOutMessage =
  | WorkerOutEvent
  | { type: 'batch'; messages: WorkerOutEvent[] }
