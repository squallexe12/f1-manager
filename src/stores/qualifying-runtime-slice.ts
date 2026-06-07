import type { CommentaryEntry, SimSpeed, TireCompound, WeatherState } from '@/types/race'
import type {
  QualiDriverResult,
  QualiFormat,
  QualiSegment,
  QualiSegmentResult,
  QualifyingResult,
} from '@/types/weekend'

/**
 * Qualifying live-reveal runtime slice (plan §M4). Session-scoped — lives
 * OUTSIDE `world` like `raceRuntime`, never autosaved (persistence contract §1).
 * The EARNED GRID itself is committed to `world.weekendState.{qualifyingResult |
 * sprintQualifyingResult}` by the store's `commitQualifyingResult` world action
 * (M3); THIS slice only carries the transient timing-tower / cutline / weather
 * presentation state the qualifying screen renders while the segments reveal.
 *
 * Execution model (M7): a client-side interval runs the synchronous
 * `simulateQualifyingSegment` engine once per segment, then reveals its attempts
 * progressively. The reducer is pure and unit-tested; store actions are thin.
 */

/** Commentary ring cap — keep the most recent N entries. */
export const QUALI_COMMENTARY_CAP = 100

export type QualiSessionPhase = 'idle' | 'running' | 'paused' | 'segment-end' | 'finished'

/** Per-driver transient state for the active segment. `bestLapTime` is the
 *  segment-local best (a fresh knockout each segment); ranking/cutline position
 *  is a presentation derivation in the M7 hook, not stored here. */
export interface QualiDriverLive {
  driverId: string
  bestLapTime: number | null
  compound: TireCompound | null
  eliminated: boolean
  onTrack: boolean
}

export interface QualiRuntimeSlice {
  format: QualiFormat
  segment: QualiSegment | null
  sessionPhase: QualiSessionPhase
  segmentTimeRemaining: number
  driverLive: Record<string, QualiDriverLive>
  /** Last advancing position before the drop zone for the active segment
   *  (15 for Q1/SQ1, 10 for Q2/SQ2, 0 for Q3/SQ3 = no cutline). */
  cutlinePosition: number
  commentary: CommentaryEntry[]
  /** The committed earned-grid classification once the session finishes. The
   *  durable copy lives in `world.weekendState`; this mirror lets the reveal
   *  screen show the final grid without re-reading the store. */
  finalClassification: QualifyingResult | null
  weather: WeatherState
  simSpeed: SimSpeed
}

export type QualiEvent =
  | { type: 'init'; format: QualiFormat }
  | { type: 'segmentStart'; segment: QualiSegment; entrants: string[]; cutlinePosition: number; weather: WeatherState; timeBudget: number }
  | { type: 'tick'; deltaSeconds: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'setSpeed'; speed: SimSpeed }
  | { type: 'selectTire'; driverId: string; compound: TireCompound }
  | { type: 'sendLap'; driverId: string }
  | { type: 'abortLap'; driverId: string }
  | { type: 'revealAttempt'; result: QualiDriverResult }
  | { type: 'segmentEnd'; result: QualiSegmentResult }
  | { type: 'commentary'; entries: CommentaryEntry[] }
  | { type: 'finalise'; classification: QualifyingResult }

export function createInitialQualiRuntime(): QualiRuntimeSlice {
  return {
    format: 'qualifying',
    segment: null,
    sessionPhase: 'idle',
    segmentTimeRemaining: 0,
    driverLive: {},
    cutlinePosition: 0,
    commentary: [],
    finalClassification: null,
    weather: 'dry',
    simSpeed: 1,
  }
}

function blankDriver(driverId: string): QualiDriverLive {
  return { driverId, bestLapTime: null, compound: null, eliminated: false, onTrack: false }
}

/** Last attempt's compound, if any — the tire the revealed lap was set on. */
function compoundFromResult(result: QualiDriverResult, fallback: TireCompound | null): TireCompound | null {
  const last = result.attempts[result.attempts.length - 1]
  return last?.compound ?? fallback
}

/**
 * Pure reducer: apply a single qualifying event to the runtime slice. No game
 * logic — presentation-state transitions only. Exported for testing; the store
 * actions are thin wrappers.
 */
export function reduceQualiEvent(
  state: QualiRuntimeSlice,
  event: QualiEvent,
): QualiRuntimeSlice {
  switch (event.type) {
    case 'init':
      return { ...createInitialQualiRuntime(), format: event.format, simSpeed: state.simSpeed }
    case 'segmentStart':
      return {
        ...state,
        segment: event.segment,
        sessionPhase: 'running',
        segmentTimeRemaining: event.timeBudget,
        cutlinePosition: event.cutlinePosition,
        weather: event.weather,
        driverLive: Object.fromEntries(event.entrants.map((id) => [id, blankDriver(id)])),
      }
    case 'tick': {
      if (state.sessionPhase !== 'running') return state
      const segmentTimeRemaining = Math.max(0, state.segmentTimeRemaining - event.deltaSeconds)
      return {
        ...state,
        segmentTimeRemaining,
        sessionPhase: segmentTimeRemaining === 0 ? 'segment-end' : state.sessionPhase,
      }
    }
    case 'pause':
      return state.sessionPhase === 'running' ? { ...state, sessionPhase: 'paused' } : state
    case 'resume':
      return state.sessionPhase === 'paused' ? { ...state, sessionPhase: 'running' } : state
    case 'setSpeed':
      return { ...state, simSpeed: event.speed }
    case 'selectTire': {
      const prev = state.driverLive[event.driverId] ?? blankDriver(event.driverId)
      return {
        ...state,
        driverLive: { ...state.driverLive, [event.driverId]: { ...prev, compound: event.compound } },
      }
    }
    case 'sendLap': {
      const prev = state.driverLive[event.driverId] ?? blankDriver(event.driverId)
      return {
        ...state,
        driverLive: { ...state.driverLive, [event.driverId]: { ...prev, onTrack: true } },
      }
    }
    case 'abortLap': {
      const prev = state.driverLive[event.driverId] ?? blankDriver(event.driverId)
      return {
        ...state,
        driverLive: { ...state.driverLive, [event.driverId]: { ...prev, onTrack: false } },
      }
    }
    case 'revealAttempt': {
      const id = event.result.driverId
      const prev = state.driverLive[id] ?? blankDriver(id)
      const revealed = event.result.bestLapTime
      // Keep the faster lap (segment best); null reveals never overwrite a time.
      const bestLapTime =
        revealed === null ? prev.bestLapTime
        : prev.bestLapTime === null ? revealed
        : Math.min(prev.bestLapTime, revealed)
      return {
        ...state,
        driverLive: {
          ...state.driverLive,
          [id]: { ...prev, bestLapTime, compound: compoundFromResult(event.result, prev.compound), onTrack: false },
        },
      }
    }
    case 'segmentEnd': {
      const driverLive = { ...state.driverLive }
      for (const r of event.result.results) {
        const prev = driverLive[r.driverId] ?? blankDriver(r.driverId)
        driverLive[r.driverId] = { ...prev, bestLapTime: r.bestLapTime, eliminated: r.eliminated, onTrack: false }
      }
      return { ...state, sessionPhase: 'segment-end', driverLive }
    }
    case 'commentary':
      return {
        ...state,
        commentary: [...state.commentary, ...event.entries].slice(-QUALI_COMMENTARY_CAP),
      }
    case 'finalise':
      return { ...state, sessionPhase: 'finished', finalClassification: event.classification }
    default:
      return state
  }
}
