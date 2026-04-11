import { SaveSystem } from '@/engine/core/save-system'
import { useGameStore } from './game-store'

// Single SaveSystem instance for the entire app lifetime — browser only
export const saveSystem = typeof window !== 'undefined' ? new SaveSystem() : null

let subscribed = false

/**
 * Wire auto-save as a side-effect subscriber, completely decoupled from action logic.
 * Call once at app boot (e.g. from PersistenceProvider). Safe to call multiple times.
 *
 * Uses a reference-equality check on world — Zustand always produces a new object
 * on any state mutation, so this fires exactly when world changes.
 */
export function setupPersistence(): void {
  if (subscribed || !saveSystem) return
  subscribed = true

  let prevWorld = useGameStore.getState().world

  useGameStore.subscribe((state) => {
    if (state.world !== prevWorld) {
      prevWorld = state.world
      if (state.world) saveSystem!.autoSave(state.world).catch(() => {})
    }
  })
}
