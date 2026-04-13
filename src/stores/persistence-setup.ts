import { SaveSystem } from '@/engine/core/save-system'
import { useGameStore } from './game-store'

// Single SaveSystem instance for the entire app lifetime — browser only
export const saveSystem = typeof window !== 'undefined' ? new SaveSystem() : null

export interface AutosaveStatus {
  lastSavedAt: number | null
  lastError: Error | null
  saveCount: number
  errorCount: number
}

type StatusListener = (status: AutosaveStatus) => void

const status: AutosaveStatus = {
  lastSavedAt: null,
  lastError: null,
  saveCount: 0,
  errorCount: 0,
}
const listeners = new Set<StatusListener>()

function notify(): void {
  for (const listener of listeners) listener({ ...status })
}

export function getAutosaveStatus(): AutosaveStatus {
  return { ...status }
}

/**
 * Subscribe to autosave status changes. Returns an unsubscribe function.
 * Imperative by design — does not trigger React re-renders on its own.
 */
export function subscribeAutosaveStatus(listener: StatusListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

let subscribed = false
let unsubscribe: (() => void) | null = null

/**
 * Wire auto-save as a side-effect subscriber, completely decoupled from action logic.
 * Call once at app boot (e.g. from PersistenceProvider). Safe to call multiple times.
 *
 * Uses a reference-equality check on `world` — Zustand always produces a new object
 * on any world mutation, so this fires exactly when `world` changes. The race
 * runtime slice (`raceRuntime`) lives outside `world` and is intentionally never
 * captured here (see IP-04 Option A / docs/architecture/persistence-contract.md).
 */
export function setupPersistence(): void {
  if (subscribed || !saveSystem) return
  subscribed = true

  let prevWorld = useGameStore.getState().world

  unsubscribe = useGameStore.subscribe((state) => {
    if (state.world === prevWorld) return
    prevWorld = state.world
    if (!state.world) return

    saveSystem!.autoSave(state.world)
      .then(() => {
        status.lastSavedAt = Date.now()
        status.lastError = null
        status.saveCount += 1
        notify()
      })
      .catch((err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err))
        status.lastError = error
        status.errorCount += 1
        notify()
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.warn('[persistence] autosave failed', error)
        }
      })
  })
}

/**
 * Tear down the persistence subscriber. Test-only — production keeps it alive
 * for the app lifetime.
 */
export function teardownPersistence(): void {
  if (unsubscribe) unsubscribe()
  unsubscribe = null
  subscribed = false
  status.lastSavedAt = null
  status.lastError = null
  status.saveCount = 0
  status.errorCount = 0
  listeners.clear()
}
