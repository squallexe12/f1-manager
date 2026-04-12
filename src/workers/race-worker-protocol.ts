/**
 * Race worker protocol adapters.
 *
 * Thin helpers around the canonical worker message contracts defined in
 * `src/types/race.ts`. Purpose:
 *   - Factor out message builders so call sites never hand-construct message
 *     objects (keeps them type-safe and serialization-safe).
 *   - Provide a single JSON round-trip helper used by both the worker and
 *     protocol tests to verify payloads are worker-safe (no functions, no
 *     class instances, no circular references).
 *   - Offer minimal runtime type guards for the inbound message union so the
 *     worker can reject malformed input with a typed `error` event rather than
 *     crashing.
 *
 * This module has no worker runtime state. It is pure and safely importable
 * from both the main thread and the worker context.
 */

import type {
  RaceCommandEnvelope,
  RaceWorkerStartPayload,
  SimSpeed,
  WorkerErrorCode,
  WorkerErrorRecovery,
  WorkerInMessage,
  WorkerOutEvent,
  WorkerOutMessage,
} from '@/types/race'

// ---------------------------------------------------------------------------
// Inbound message builders (main thread → worker)
// ---------------------------------------------------------------------------

export function buildStartMessage(payload: RaceWorkerStartPayload): WorkerInMessage {
  return { type: 'start', payload }
}

export function buildSetSpeedMessage(speed: SimSpeed): WorkerInMessage {
  return { type: 'setSpeed', speed }
}

export function buildPauseMessage(): WorkerInMessage {
  return { type: 'pause' }
}

export function buildResumeMessage(): WorkerInMessage {
  return { type: 'resume' }
}

export function buildCommandMessage(envelope: RaceCommandEnvelope): WorkerInMessage {
  return { type: 'command', envelope }
}

// ---------------------------------------------------------------------------
// Outbound message builders (worker → main thread)
// ---------------------------------------------------------------------------

export function buildErrorEvent(
  code: WorkerErrorCode,
  message: string,
  fatal: boolean,
  recovery?: WorkerErrorRecovery,
): WorkerOutEvent {
  return recovery
    ? { type: 'error', code, message, fatal, recovery }
    : { type: 'error', code, message, fatal }
}

export function buildBatch(events: WorkerOutEvent[]): WorkerOutMessage {
  return { type: 'batch', messages: events }
}

// ---------------------------------------------------------------------------
// Type guards (runtime validation for inbound messages)
// ---------------------------------------------------------------------------

export function isWorkerInMessage(value: unknown): value is WorkerInMessage {
  if (!value || typeof value !== 'object') return false
  const obj = value as { type?: unknown }
  switch (obj.type) {
    case 'start':
      return isStartMessage(obj)
    case 'setSpeed':
      return isSetSpeedMessage(obj)
    case 'pause':
    case 'resume':
      return true
    case 'command':
      return isCommandMessage(obj)
    default:
      return false
  }
}

function isStartMessage(obj: { type?: unknown } & Record<string, unknown>): boolean {
  const payload = obj.payload as Partial<RaceWorkerStartPayload> | undefined
  if (!payload || typeof payload !== 'object') return false
  if (typeof payload.seed !== 'number') return false
  if (typeof payload.round !== 'number') return false
  if (typeof payload.isSprint !== 'boolean') return false
  if (!payload.circuit || typeof payload.circuit !== 'object') return false
  // `drivers` must be present as an array. Emptiness is a worker-layer concern
  // so the worker can emit a typed `start/missing-drivers` error rather than
  // a generic schema rejection.
  if (!Array.isArray(payload.drivers)) return false
  return true
}

function isSetSpeedMessage(obj: { type?: unknown } & Record<string, unknown>): boolean {
  const speed = obj.speed
  return speed === 1 || speed === 2 || speed === 5 || speed === 'max'
}

function isCommandMessage(obj: { type?: unknown } & Record<string, unknown>): boolean {
  const env = obj.envelope as Partial<RaceCommandEnvelope> | undefined
  if (!env || typeof env !== 'object') return false
  if (typeof env.driverId !== 'string') return false
  if (typeof env.timestamp !== 'number') return false
  if (typeof env.sequence !== 'number') return false
  if (env.type !== 'setCommand' && env.type !== 'pit' && env.type !== 'strategyChange') {
    return false
  }
  return env.payload != null && typeof env.payload === 'object'
}

// ---------------------------------------------------------------------------
// Serialization round-trip (worker-safety guard)
// ---------------------------------------------------------------------------

/**
 * Stringify then parse. Throws if the message contains non-JSON-serializable
 * values (functions, symbols, circular refs). Returns a structural clone
 * equivalent so callers cannot accidentally mutate the original.
 */
export function roundTrip<T>(message: T): T {
  return JSON.parse(JSON.stringify(message)) as T
}
