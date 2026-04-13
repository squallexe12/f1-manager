import type {
  RaceCommandEnvelope,
  RaceWorkerStartPayload,
  SimSpeed,
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
} from '@/workers/race-worker-protocol'
import type { RaceCommandBus } from './race-command-bus'

/**
 * Minimal surface every worker transport must expose. Abstracts away the
 * difference between a real Web Worker and an in-thread test double.
 */
export interface RaceWorkerHandle {
  postMessage(message: WorkerInMessage): void
  setOnMessage(listener: (event: WorkerOutMessage) => void): void
  terminate(): void
}

export interface StoreBinding {
  applyRaceWorkerEvent: (event: WorkerOutEvent) => void
  setRaceWorkerStatus: (status: 'idle' | 'starting' | 'running' | 'paused' | 'error' | 'finished') => void
  setRacePhase: (phase: 'idle' | 'running' | 'paused' | 'finished') => void
  setRaceSimSpeed: (speed: SimSpeed) => void
  setDriverCommandLocal: (driverId: string, command: import('@/types/race').DriverCommand) => void
  resetRaceRuntime: () => void
}

export interface RaceWorkerAdapter {
  start(payload: RaceWorkerStartPayload): void
  pause(): void
  resume(): void
  setSpeed(speed: SimSpeed): void
  dispose(): void
}

export interface CreateAdapterOptions {
  handle: RaceWorkerHandle
  store: StoreBinding
  commandBus: RaceCommandBus
}

/**
 * Wire a worker handle to the store and command bus. Returns a lifecycle
 * controller; callers own disposal.
 *
 * Responsibilities:
 *   - Translate worker output messages into store mutations via
 *     {@link StoreBinding.applyRaceWorkerEvent}. `batch` messages are
 *     flattened; atomic events are forwarded verbatim.
 *   - Forward `RaceCommandEnvelope`s from the command bus to the worker.
 *   - Mirror dispatched command envelopes into the UI-facing driver command
 *     map so UI state stays in sync without a round-trip.
 *   - Own worker termination.
 */
export function attachRaceWorker(options: CreateAdapterOptions): RaceWorkerAdapter {
  const { handle, store, commandBus } = options

  handle.setOnMessage((message) => {
    if (message.type === 'batch') {
      for (const inner of message.messages) {
        store.applyRaceWorkerEvent(inner)
      }
      return
    }
    store.applyRaceWorkerEvent(message)
  })

  const unsubscribeBus = commandBus.subscribe((envelope: RaceCommandEnvelope) => {
    handle.postMessage(buildCommandMessage(envelope))
    // Mirror UI-facing command state so driver command widgets update
    // immediately without waiting for the worker to echo anything back.
    if (envelope.type === 'setCommand') {
      store.setDriverCommandLocal(envelope.driverId, envelope.payload.command)
    } else if (envelope.type === 'pit') {
      store.setDriverCommandLocal(envelope.driverId, 'pit')
    }
  })

  let disposed = false

  return {
    start(payload) {
      if (disposed) return
      store.setRaceWorkerStatus('starting')
      store.setRacePhase('running')
      handle.postMessage(buildStartMessage(payload))
    },
    pause() {
      if (disposed) return
      handle.postMessage(buildPauseMessage())
      store.setRaceWorkerStatus('paused')
      store.setRacePhase('paused')
    },
    resume() {
      if (disposed) return
      handle.postMessage(buildResumeMessage())
      store.setRaceWorkerStatus('running')
      store.setRacePhase('running')
    },
    setSpeed(speed) {
      if (disposed) return
      handle.postMessage(buildSetSpeedMessage(speed))
      store.setRaceSimSpeed(speed)
    },
    dispose() {
      if (disposed) return
      disposed = true
      unsubscribeBus()
      handle.terminate()
    },
  }
}

/**
 * Browser factory: instantiates the real race simulation Web Worker.
 * Server-side rendering callers should avoid invoking this — Next.js route
 * components must guard with `typeof window !== 'undefined'`.
 */
export function createBrowserRaceWorkerHandle(): RaceWorkerHandle {
  if (typeof Worker === 'undefined') {
    throw new Error('Web Worker API is not available in this environment')
  }
  const worker = new Worker(
    new URL('../../workers/race-sim-worker.ts', import.meta.url),
    { type: 'module' },
  )
  let listener: ((event: WorkerOutMessage) => void) | null = null
  worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
    listener?.(event.data)
  }
  return {
    postMessage(message) {
      worker.postMessage(message)
    },
    setOnMessage(next) {
      listener = next
    },
    terminate() {
      worker.terminate()
      listener = null
    },
  }
}
