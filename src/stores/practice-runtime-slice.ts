import type { CommentaryEntry, SimSpeed, TireCompound } from '@/types/race'
import type { PracticeProgram } from '@/types/weekend'

/**
 * Practice live-reveal runtime slice (plan §M4). Session-scoped — lives OUTSIDE
 * `world`, exactly like `raceRuntime`, and is never autosaved (persistence
 * contract §1). The durable accrual (setup confidence, tire-set ledger,
 * `practiceResults`) is committed to `world.weekendState` by the store's
 * `runPracticeSession` world action; THIS slice only carries the transient
 * "live" presentation state the practice screen renders during the countdown.
 *
 * The reducer is pure and exported for direct unit testing; the store actions
 * are thin wrappers around it (mirroring `reduceWorkerEvent`).
 */

/** Commentary ring cap — keep the most recent N entries (memory-bounded feed). */
export const PRACTICE_COMMENTARY_CAP = 100

export type PracticeStatus = 'idle' | 'running' | 'paused' | 'session-end'

/** Per-driver transient state for the active FP session. `setupConfidence` /
 *  `tireDegRead` here are the LIVE displayed figures (the reveal animates them
 *  toward the values `runPracticeSession` will commit) — the durable values
 *  live in `world.weekendState.driverSetup`. */
export interface PracticeDriverLive {
  driverId: string
  program: PracticeProgram | null
  compound: TireCompound | null
  setupConfidence: number
  tireDegRead: number
  lapsCompleted: number
}

export interface PracticeRuntimeSlice {
  status: PracticeStatus
  /** Mirror of `world.weekendState.practiceResults.length` — the active FP
   *  index. The persisted length is the source of truth; this is refreshed on
   *  rehydrate so a reload never re-runs a completed FP. */
  sessionIndex: number
  timeRemaining: number
  driverLive: Record<string, PracticeDriverLive>
  commentary: CommentaryEntry[]
  simSpeed: SimSpeed
}

export type PracticeEvent =
  | { type: 'start'; sessionIndex: number; timeBudget: number; drivers: PracticeDriverLive[] }
  | { type: 'tick'; deltaSeconds: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'setSpeed'; speed: SimSpeed }
  | { type: 'selectRunPlan'; driverId: string; program: PracticeProgram | null }
  | { type: 'selectTire'; driverId: string; compound: TireCompound }
  | { type: 'progress'; driverId: string; setupConfidence: number; tireDegRead: number; lapsCompleted: number }
  | { type: 'commentary'; entries: CommentaryEntry[] }
  | { type: 'end' }

export function createInitialPracticeRuntime(): PracticeRuntimeSlice {
  return {
    status: 'idle',
    sessionIndex: 0,
    timeRemaining: 0,
    driverLive: {},
    commentary: [],
    simSpeed: 1,
  }
}

/** Fresh blank live entry — used when a select/progress event names a driver the
 *  slice has not seen yet (e.g. a tire is picked before the session starts). */
function blankDriver(driverId: string): PracticeDriverLive {
  return { driverId, program: null, compound: null, setupConfidence: 0, tireDegRead: 0, lapsCompleted: 0 }
}

/**
 * Pure reducer: apply a single practice event to the runtime slice. No game
 * logic — purely presentation-state transitions. Exported for testing; the
 * store actions are thin wrappers.
 */
export function reducePracticeEvent(
  state: PracticeRuntimeSlice,
  event: PracticeEvent,
): PracticeRuntimeSlice {
  switch (event.type) {
    case 'start':
      return {
        ...state,
        status: 'running',
        sessionIndex: event.sessionIndex,
        timeRemaining: event.timeBudget,
        driverLive: Object.fromEntries(event.drivers.map((d) => [d.driverId, d])),
        commentary: [],
      }
    case 'tick': {
      if (state.status !== 'running') return state
      const timeRemaining = Math.max(0, state.timeRemaining - event.deltaSeconds)
      return {
        ...state,
        timeRemaining,
        status: timeRemaining === 0 ? 'session-end' : state.status,
      }
    }
    case 'pause':
      return state.status === 'running' ? { ...state, status: 'paused' } : state
    case 'resume':
      return state.status === 'paused' ? { ...state, status: 'running' } : state
    case 'setSpeed':
      return { ...state, simSpeed: event.speed }
    case 'selectRunPlan': {
      const prev = state.driverLive[event.driverId] ?? blankDriver(event.driverId)
      return {
        ...state,
        driverLive: { ...state.driverLive, [event.driverId]: { ...prev, program: event.program } },
      }
    }
    case 'selectTire': {
      const prev = state.driverLive[event.driverId] ?? blankDriver(event.driverId)
      return {
        ...state,
        driverLive: { ...state.driverLive, [event.driverId]: { ...prev, compound: event.compound } },
      }
    }
    case 'progress': {
      const prev = state.driverLive[event.driverId] ?? blankDriver(event.driverId)
      return {
        ...state,
        driverLive: {
          ...state.driverLive,
          [event.driverId]: {
            ...prev,
            setupConfidence: event.setupConfidence,
            tireDegRead: event.tireDegRead,
            lapsCompleted: event.lapsCompleted,
          },
        },
      }
    }
    case 'commentary':
      return {
        ...state,
        commentary: [...state.commentary, ...event.entries].slice(-PRACTICE_COMMENTARY_CAP),
      }
    case 'end':
      return { ...state, status: 'session-end' }
    default:
      return state
  }
}
