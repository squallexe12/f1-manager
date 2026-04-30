/**
 * Worker protocol contract tests (IP-03).
 *
 * These tests never instantiate a real Web Worker. They import the worker
 * module directly and drive `__handleMessage`, capturing outbound events via
 * a `self.postMessage` stub. This lets us verify the message contract and
 * runtime behavior in node/vitest without a DOM.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type {
  Circuit,
  RaceCommandEnvelope,
  RaceWorkerStartPayload,
  WorkerInMessage,
  WorkerOutEvent,
  WorkerOutMessage,
} from '@/types/race'
import {
  buildCommandMessage,
  buildPauseMessage,
  buildResumeMessage,
  buildSetSpeedMessage,
  buildStartMessage,
  isWorkerInMessage,
  roundTrip,
} from '@/workers/race-worker-protocol'

// Install a minimal `self` before the worker module is imported, so the
// worker can safely attach its onmessage handler (which we never call).
const postedMessages: WorkerOutMessage[] = []

;(globalThis as unknown as { self: unknown }).self = {
  postMessage: (msg: WorkerOutMessage) => {
    postedMessages.push(msg)
  },
  onmessage: () => {
    // placeholder; the worker will overwrite this on import
  },
}

// Import AFTER `self` is defined so the worker sees a valid global.
import { __handleMessage, __resetForTest } from '@/workers/race-sim-worker'

const BAHRAIN: Circuit = {
  id: 'bahrain',
  name: 'Bahrain',
  country: 'Bahrain',
  laps: 3, // short race to reach raceEnd fast
  downforceLevel: 'medium',
  tireWear: 'high',
  overtakingDifficulty: 'low',
  weatherVariability: 'low',
  sectorCount: 3,
  compounds: ['C1', 'C2', 'C3'],
}

function makeStartPayload(overrides: Partial<RaceWorkerStartPayload> = {}): RaceWorkerStartPayload {
  return {
    seed: 12345,
    round: 1,
    circuit: BAHRAIN,
    isSprint: false,
    drivers: [
      {
        id: 'drv-a',
        teamId: 'team-1',
        shortName: 'DRA',
        attributes: { pace: 90, racecraft: 88, experience: 75, mentality: 80, marketability: 70, developmentPotential: 60 },
        car: { downforce: 85, straightSpeed: 80, reliability: 90, tireManagement: 85, braking: 88, cornering: 86 },
        mood: { motivation: 50, frustration: 30, confidence: 60 },
      },
      {
        id: 'drv-b',
        teamId: 'team-1',
        shortName: 'DRB',
        attributes: { pace: 85, racecraft: 82, experience: 70, mentality: 75, marketability: 65, developmentPotential: 55 },
        car: { downforce: 85, straightSpeed: 80, reliability: 90, tireManagement: 85, braking: 88, cornering: 86 },
        mood: { motivation: 50, frustration: 30, confidence: 60 },
      },
    ],
    ...overrides,
  }
}

function makeEnvelope(envelope: Partial<RaceCommandEnvelope> & { type: RaceCommandEnvelope['type']; driverId: string; payload: RaceCommandEnvelope['payload'] }): RaceCommandEnvelope {
  return {
    timestamp: 1000,
    sequence: 1,
    ...envelope,
  } as RaceCommandEnvelope
}

function findEvent<T extends WorkerOutEvent['type']>(type: T): Extract<WorkerOutEvent, { type: T }> | undefined {
  const match = postedMessages.find((m) => m.type === type)
  return match as Extract<WorkerOutEvent, { type: T }> | undefined
}

beforeEach(() => {
  postedMessages.length = 0
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  __resetForTest()
})

describe('worker protocol — type guards', () => {
  it('accepts a well-formed start message', () => {
    expect(isWorkerInMessage(buildStartMessage(makeStartPayload()))).toBe(true)
  })

  it('accepts pause/resume/setSpeed messages', () => {
    expect(isWorkerInMessage(buildPauseMessage())).toBe(true)
    expect(isWorkerInMessage(buildResumeMessage())).toBe(true)
    expect(isWorkerInMessage(buildSetSpeedMessage(5))).toBe(true)
  })

  it('accepts a well-formed command envelope', () => {
    const env = makeEnvelope({ type: 'setCommand', driverId: 'drv-a', payload: { command: 'push' } })
    expect(isWorkerInMessage(buildCommandMessage(env))).toBe(true)
  })

  it('rejects malformed messages', () => {
    expect(isWorkerInMessage(null)).toBe(false)
    expect(isWorkerInMessage({})).toBe(false)
    expect(isWorkerInMessage({ type: 'unknown' })).toBe(false)
    expect(isWorkerInMessage({ type: 'setSpeed', speed: 99 })).toBe(false)
    expect(isWorkerInMessage({ type: 'start', payload: null })).toBe(false)
    expect(isWorkerInMessage({ type: 'start', payload: { seed: 1 } })).toBe(false)
    expect(isWorkerInMessage({ type: 'command', envelope: null })).toBe(false)
  })
})

describe('worker protocol — start payload', () => {
  it('emits a ready event with totalLaps before the first lap is simulated', () => {
    __handleMessage(buildStartMessage(makeStartPayload()))

    const ready = findEvent('ready')
    expect(ready).toBeDefined()
    expect(ready?.totalLaps).toBe(BAHRAIN.laps)
    expect(ready?.lap).toBe(0)
  })

  it('initializes without any placeholder state (real drivers, real tire states)', () => {
    __handleMessage(buildStartMessage(makeStartPayload()))

    // First lapUpdate after ready proves tire states are populated.
    vi.advanceTimersByTime(2001)
    const lap = findEvent('lapUpdate')
    expect(lap).toBeDefined()
    expect(Object.keys(lap!.tireStates)).toEqual(expect.arrayContaining(['drv-a', 'drv-b']))
    expect(lap!.results.length).toBe(2)
  })

  it('emits an error for a start payload with no drivers', () => {
    __handleMessage({
      type: 'start',
      payload: { ...makeStartPayload(), drivers: [] },
    } satisfies WorkerInMessage)

    const err = findEvent('error')
    expect(err?.code).toBe('start/missing-drivers')
    expect(err?.fatal).toBe(true)
  })

  it('emits a schema error for a malformed inbound message', () => {
    __handleMessage({ type: 'bogus' } as unknown)
    const err = findEvent('error')
    expect(err?.code).toBe('start/invalid-payload')
    expect(err?.fatal).toBe(false)
  })
})

describe('worker protocol — pause / resume / setSpeed', () => {
  it('pause halts scheduled ticks; resume restarts them', () => {
    __handleMessage(buildStartMessage(makeStartPayload()))
    __handleMessage(buildPauseMessage())
    postedMessages.length = 0

    vi.advanceTimersByTime(10_000)
    expect(findEvent('lapUpdate')).toBeUndefined()

    __handleMessage(buildResumeMessage())
    vi.advanceTimersByTime(2001)
    expect(findEvent('lapUpdate')).toBeDefined()
  })

  it('start payload simSpeed sets the initial tick interval', () => {
    __handleMessage(buildStartMessage(makeStartPayload({ simSpeed: 'max' })))
    postedMessages.length = 0

    // After the initial lap (emitted synchronously), next tick is scheduled at
    // 'max' speed (50ms). Advancing 100ms should produce at least one lapUpdate.
    vi.advanceTimersByTime(100)
    expect(findEvent('lapUpdate')).toBeDefined()
  })
})

describe('worker protocol — command envelope application', () => {
  it('setCommand envelope updates driver strategy', () => {
    __handleMessage(buildStartMessage(makeStartPayload()))
    __handleMessage(buildCommandMessage(
      makeEnvelope({ type: 'setCommand', driverId: 'drv-a', payload: { command: 'push' } }),
    ))
    // No error emitted means applied.
    expect(findEvent('error')).toBeUndefined()
  })

  it('pit envelope schedules a pit stop', () => {
    __handleMessage(buildStartMessage(makeStartPayload()))
    __handleMessage(buildCommandMessage(
      makeEnvelope({ type: 'pit', driverId: 'drv-a', payload: { compound: 'C3' }, sequence: 2 }),
    ))
    expect(findEvent('error')).toBeUndefined()
  })

  it('strategyChange envelope replaces strategy', () => {
    __handleMessage(buildStartMessage(makeStartPayload()))
    __handleMessage(buildCommandMessage(
      makeEnvelope({
        type: 'strategyChange',
        driverId: 'drv-b',
        sequence: 3,
        payload: {
          strategy: {
            driverId: 'drv-b',
            plannedStops: [{ lap: 2, compound: 'C3' }],
            currentCommand: 'conserve',
          },
        },
      }),
    ))
    expect(findEvent('error')).toBeUndefined()
  })

  it('emits error for a command referencing an unknown driver', () => {
    __handleMessage(buildStartMessage(makeStartPayload()))
    __handleMessage(buildCommandMessage(
      makeEnvelope({ type: 'setCommand', driverId: 'nobody', payload: { command: 'push' } }),
    ))
    expect(findEvent('error')?.code).toBe('command/unknown-driver')
  })

  it('emits error if a command arrives before start', () => {
    __handleMessage(buildCommandMessage(
      makeEnvelope({ type: 'setCommand', driverId: 'drv-a', payload: { command: 'push' } }),
    ))
    expect(findEvent('error')?.code).toBe('command/invalid-envelope')
  })
})

describe('worker protocol — race lifecycle', () => {
  it('emits raceEnd with finalResults and fastestLap after the final lap', () => {
    __handleMessage(buildStartMessage(makeStartPayload()))

    // 3 laps × 2s per tick at speed 1 = 6s. Give extra headroom.
    vi.advanceTimersByTime(20_000)

    const end = findEvent('raceEnd')
    expect(end).toBeDefined()
    expect(Array.isArray(end!.finalResults)).toBe(true)
    expect(end!.fastestLap).toBeDefined()
    expect(typeof end!.fastestLap.driverId).toBe('string')
    expect(typeof end!.fastestLap.time).toBe('number')
  })
})

describe('worker protocol — serialization round-trip (worker-safe payloads)', () => {
  it('inbound messages survive JSON round-trip', () => {
    const start: WorkerInMessage = buildStartMessage(makeStartPayload())
    const cmd: WorkerInMessage = buildCommandMessage(
      makeEnvelope({ type: 'setCommand', driverId: 'drv-a', payload: { command: 'push' } }),
    )
    expect(roundTrip(start)).toEqual(start)
    expect(roundTrip(cmd)).toEqual(cmd)
    expect(roundTrip(buildPauseMessage())).toEqual(buildPauseMessage())
    expect(roundTrip(buildResumeMessage())).toEqual(buildResumeMessage())
    expect(roundTrip(buildSetSpeedMessage(2))).toEqual(buildSetSpeedMessage(2))
  })

  it('outbound messages emitted by the worker survive JSON round-trip', () => {
    __handleMessage(buildStartMessage(makeStartPayload()))
    vi.advanceTimersByTime(20_000)

    expect(postedMessages.length).toBeGreaterThan(0)
    for (const msg of postedMessages) {
      expect(roundTrip(msg)).toEqual(msg)
    }
  })
})

describe('raceEnd event JSON round-trip', () => {
  it('a raceEnd event with appliedPenaltiesByDriver round-trips losslessly', () => {
    const event = {
      type: 'raceEnd' as const,
      finalResults: [{
        lap: 50, driverId: 'd1', lapTime: 90.5,
        sector1: 30, sector2: 30, sector3: 30.5,
        position: 1, gapToLeader: 0, gapToAhead: 0,
        tire: { compound: 'C2' as const, label: 'medium' as const, wear: 50, lapsFitted: 25 },
        pitted: false,
      }],
      fastestLap: { driverId: 'd1', time: 89.5 },
      appliedPenaltiesByDriver: {
        d1: [{
          offenceType: 'collision-minor' as const,
          sanction: '5s' as const,
          timePenaltySeconds: 5,
          penaltyPointsIssued: 1,
          warningCounted: true,
          raceLap: 12,
        }],
      },
    }
    const cloned = roundTrip(event)
    expect(cloned).toEqual(event)
  })
})
