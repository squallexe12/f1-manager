import type {
  CommentaryEntry,
  DriverCommand,
  LapResult,
  RaceIncident,
  SimSpeed,
  TireCompound,
  TireState,
  WeatherForecast,
  WorkerErrorCode,
  WorkerOutEvent,
  RaceState,
} from '@/types/race'

/**
 * Worker lifecycle status. Surfaced to UI so a failure can show a recovery
 * surface without the caller needing to reason about raw error codes.
 */
export type WorkerStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'paused'
  | 'error'
  | 'finished'

export type RaceSimPhase = 'idle' | 'running' | 'paused' | 'finished'

export interface RaceRuntimeError {
  code: WorkerErrorCode
  message: string
  fatal: boolean
  lastValidLap: number
}

export interface RaceRuntimeSlice {
  workerStatus: WorkerStatus
  phase: RaceSimPhase
  currentLap: number
  totalLaps: number
  weather: WeatherForecast
  safetyCar: RaceState['safetyCar']
  trackTemp: number
  lastLapResults: LapResult[]
  tireStates: Record<string, TireState>
  commentary: CommentaryEntry[]
  incidents: RaceIncident[]
  driverCommands: Record<string, DriverCommand>
  wearHistory: Record<string, number[]>
  compoundHistory: Record<string, TireCompound[]>
  simSpeed: SimSpeed
  finalResults: LapResult[] | null
  fastestLap: { driverId: string; time: number } | null
  lastError: RaceRuntimeError | null
}

const INITIAL_WEATHER: WeatherForecast = {
  current: 'dry',
  rainProbability: 0,
  changeInLaps: null,
}

export function createInitialRaceRuntime(): RaceRuntimeSlice {
  return {
    workerStatus: 'idle',
    phase: 'idle',
    currentLap: 0,
    totalLaps: 0,
    weather: INITIAL_WEATHER,
    safetyCar: 'green',
    trackTemp: 35,
    lastLapResults: [],
    tireStates: {},
    commentary: [],
    incidents: [],
    driverCommands: {},
    wearHistory: {},
    compoundHistory: {},
    simSpeed: 1,
    finalResults: null,
    fastestLap: null,
    lastError: null,
  }
}

/**
 * Pure reducer: apply a single worker output event to the runtime slice.
 * Exported for testing — store action is a thin wrapper.
 */
export function reduceWorkerEvent(
  state: RaceRuntimeSlice,
  event: WorkerOutEvent,
): RaceRuntimeSlice {
  switch (event.type) {
    case 'ready':
      return {
        ...state,
        workerStatus: 'running',
        phase: 'running',
        currentLap: event.lap,
        totalLaps: event.totalLaps,
        lastError: null,
      }
    case 'lapUpdate': {
      const wearHistory = { ...state.wearHistory }
      const compoundHistory = { ...state.compoundHistory }
      for (const [driverId, tire] of Object.entries(event.tireStates)) {
        const priorWear = wearHistory[driverId] ?? []
        wearHistory[driverId] = [...priorWear, tire.wear]
        const priorCompound = compoundHistory[driverId] ?? []
        compoundHistory[driverId] = [...priorCompound, tire.compound]
      }
      return {
        ...state,
        currentLap: event.lap,
        lastLapResults: event.results,
        tireStates: { ...event.tireStates },
        weather: event.weather,
        safetyCar: event.safetyCar,
        wearHistory,
        compoundHistory,
      }
    }
    case 'commentary':
      return {
        ...state,
        commentary: [...state.commentary, ...event.entries],
      }
    case 'incident':
      return {
        ...state,
        incidents: [...state.incidents, event.incident],
      }
    case 'raceEnd':
      return {
        ...state,
        workerStatus: 'finished',
        phase: 'finished',
        finalResults: event.finalResults,
        fastestLap: event.fastestLap,
      }
    case 'error':
      return {
        ...state,
        workerStatus: 'error',
        lastError: {
          code: event.code,
          message: event.message,
          fatal: event.fatal,
          lastValidLap: event.recovery?.lastValidLap ?? state.currentLap,
        },
      }
    default:
      return state
  }
}
