/**
 * Integration tests for IP-04 store-mediated worker rollout.
 *
 * Drives the full store ↔ adapter ↔ worker pipeline in-thread by routing
 * inbound messages directly into `__handleMessage` and flushing worker
 * outbound messages through the adapter's listener on demand.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type {
  Circuit,
  RaceWorkerStartPayload,
  WorkerInMessage,
  WorkerOutMessage,
} from '@/types/race'

const postedOutbound: WorkerOutMessage[] = []
;(globalThis as unknown as { self: unknown }).self = {
  postMessage: (msg: WorkerOutMessage) => {
    postedOutbound.push(msg)
  },
  onmessage: () => {},
}

import { __handleMessage, __resetForTest } from '@/workers/race-sim-worker'
import {
  attachRaceWorker,
  type RaceWorkerHandle,
} from '@/engine/race/race-worker-adapter'
import { useGameStore } from '@/stores/game-store'
import { createInitialRaceRuntime } from '@/stores/race-runtime-slice'
import { createRaceCommandBus } from '@/engine/race/race-command-bus'

const BAHRAIN: Circuit = {
  id: 'bahrain',
  name: 'Bahrain',
  country: 'Bahrain',
  laps: 3,
  downforceLevel: 'medium',
  tireWear: 'high',
  overtakingDifficulty: 'low',
  weatherVariability: 'low',
  sectorCount: 3,
  compounds: ['C1', 'C2', 'C3'],
}

function makeStartPayload(): RaceWorkerStartPayload {
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
  }
}

interface TestHandle extends RaceWorkerHandle {
  flush(): void
}

function createInThreadHandle(): TestHandle {
  let listener: ((event: WorkerOutMessage) => void) | null = null
  const flush = () => {
    while (postedOutbound.length) {
      const next = postedOutbound.shift()!
      listener?.(next)
    }
  }
  return {
    postMessage(message: WorkerInMessage) {
      __handleMessage(message)
      flush()
    },
    setOnMessage(next) {
      listener = next
      flush()
    },
    terminate() {
      listener = null
    },
    flush,
  }
}

function buildAdapter(handle: RaceWorkerHandle) {
  const store = useGameStore.getState()
  return attachRaceWorker({
    handle,
    store: {
      applyRaceWorkerEvent: store.applyRaceWorkerEvent,
      setRaceWorkerStatus: store.setRaceWorkerStatus,
      setRacePhase: store.setRacePhase,
      setRaceSimSpeed: store.setRaceSimSpeed,
      setDriverCommandLocal: store.setDriverCommandLocal,
      resetRaceRuntime: store.resetRaceRuntime,
    },
    commandBus: store.raceCommandBus,
  })
}

beforeEach(() => {
  postedOutbound.length = 0
  vi.useFakeTimers()
  useGameStore.setState({
    raceRuntime: createInitialRaceRuntime(),
    raceCommandBus: createRaceCommandBus(),
  })
})

afterEach(() => {
  vi.useRealTimers()
  __resetForTest()
})

describe('IP-04 store-mediated race runtime', () => {
  it('start surfaces ready via the store and sets totalLaps/phase/workerStatus', () => {
    const handle = createInThreadHandle()
    const adapter = buildAdapter(handle)

    adapter.start(makeStartPayload())

    const runtime = useGameStore.getState().raceRuntime
    expect(runtime.totalLaps).toBe(BAHRAIN.laps)
    expect(runtime.phase).toBe('running')
    expect(runtime.workerStatus).toBe('running')
    adapter.dispose()
  })

  it('lapUpdate events flow into the store slice', () => {
    const handle = createInThreadHandle()
    const adapter = buildAdapter(handle)

    adapter.start(makeStartPayload())
    vi.advanceTimersByTime(2001)
    handle.flush()

    const runtime = useGameStore.getState().raceRuntime
    expect(runtime.currentLap).toBeGreaterThanOrEqual(1)
    expect(runtime.lastLapResults.length).toBe(2)
    expect(Object.keys(runtime.tireStates)).toEqual(expect.arrayContaining(['drv-a', 'drv-b']))
    adapter.dispose()
  })

  it('pause/resume keep store phase and workerStatus synchronized', () => {
    const handle = createInThreadHandle()
    const adapter = buildAdapter(handle)

    adapter.start(makeStartPayload())
    adapter.pause()
    expect(useGameStore.getState().raceRuntime.phase).toBe('paused')
    expect(useGameStore.getState().raceRuntime.workerStatus).toBe('paused')

    adapter.resume()
    expect(useGameStore.getState().raceRuntime.phase).toBe('running')
    expect(useGameStore.getState().raceRuntime.workerStatus).toBe('running')

    adapter.dispose()
  })

  it('bus dispatch forwards a RaceCommandEnvelope to the worker and mirrors UI command state', () => {
    const handle = createInThreadHandle()
    const adapter = buildAdapter(handle)

    adapter.start(makeStartPayload())
    useGameStore.getState().setDriverCommand('drv-a', 'push')

    const runtime = useGameStore.getState().raceRuntime
    expect(runtime.driverCommands['drv-a']).toBe('push')
    expect(runtime.lastError).toBeNull()
    adapter.dispose()
  })

  it('pit dispatch mirrors driverCommand to "pit" and forwards to worker', () => {
    const handle = createInThreadHandle()
    const adapter = buildAdapter(handle)

    adapter.start(makeStartPayload())
    useGameStore.getState().requestPit('drv-b', 'C3')

    const runtime = useGameStore.getState().raceRuntime
    expect(runtime.driverCommands['drv-b']).toBe('pit')
    expect(runtime.lastError).toBeNull()
    adapter.dispose()
  })

  it('raceEnd transitions store to finished with finalResults and fastestLap', () => {
    const handle = createInThreadHandle()
    const adapter = buildAdapter(handle)

    adapter.start(makeStartPayload())
    vi.advanceTimersByTime(20_000)
    handle.flush()

    const runtime = useGameStore.getState().raceRuntime
    expect(runtime.phase).toBe('finished')
    expect(runtime.workerStatus).toBe('finished')
    expect(runtime.finalResults).not.toBeNull()
    expect(runtime.fastestLap).not.toBeNull()
    expect(typeof runtime.fastestLap!.driverId).toBe('string')
    adapter.dispose()
  })

  it('error event sets workerStatus to error and captures recovery data (Tier 1)', () => {
    const handle = createInThreadHandle()
    const adapter = buildAdapter(handle)

    const bad: RaceWorkerStartPayload = { ...makeStartPayload(), drivers: [] }
    adapter.start(bad)

    const runtime = useGameStore.getState().raceRuntime
    expect(runtime.workerStatus).toBe('error')
    expect(runtime.lastError?.code).toBe('start/missing-drivers')
    expect(runtime.lastError?.fatal).toBe(true)
    adapter.dispose()
  })

  it('setSpeed posts a setSpeed message and updates simSpeed in the store', () => {
    const handle = createInThreadHandle()
    const adapter = buildAdapter(handle)

    adapter.start(makeStartPayload())
    adapter.setSpeed(5)

    expect(useGameStore.getState().raceRuntime.simSpeed).toBe(5)
    adapter.dispose()
  })

  it('reduceWorkerEvent correctly accumulates wear history across laps', () => {
    const handle = createInThreadHandle()
    const adapter = buildAdapter(handle)

    adapter.start(makeStartPayload())
    vi.advanceTimersByTime(2001)
    handle.flush()
    vi.advanceTimersByTime(2001)
    handle.flush()

    const runtime = useGameStore.getState().raceRuntime
    expect(runtime.wearHistory['drv-a']?.length).toBeGreaterThanOrEqual(1)
    adapter.dispose()
  })

  it('reduceWorkerEvent accumulates compound history parallel to wear history', () => {
    const handle = createInThreadHandle()
    const adapter = buildAdapter(handle)

    adapter.start(makeStartPayload())
    vi.advanceTimersByTime(2001)
    handle.flush()
    vi.advanceTimersByTime(2001)
    handle.flush()

    const runtime = useGameStore.getState().raceRuntime
    const wearLen = runtime.wearHistory['drv-a']?.length ?? 0
    expect(runtime.compoundHistory['drv-a']?.length).toBe(wearLen)
    expect(wearLen).toBeGreaterThanOrEqual(1)
    // Every entry must be a valid Pirelli compound label
    for (const c of runtime.compoundHistory['drv-a'] ?? []) {
      expect(['C1', 'C2', 'C3', 'C4', 'C5']).toContain(c)
    }
    adapter.dispose()
  })
})
