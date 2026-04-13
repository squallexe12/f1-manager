import { useState, useCallback } from 'react'
import { useGameStore } from '@/stores/game-store'
import { saveSystem } from '@/stores/persistence-setup'
import type { SlotInfo } from '@/engine/core/save-system'

export type SaveAction = 'save' | 'load' | 'delete' | 'import' | 'export' | null

export interface SaveGameStatus {
  isSaving: boolean
  isLoading: boolean
  lastAction: SaveAction
  lastError: string | null
}

/**
 * Hook for explicit save/load operations.
 * Reads world state imperatively via getState() to avoid re-render coupling.
 * Auto-save is handled separately by the persistence subscriber.
 *
 * Loading a save replaces `world` only — the race runtime slice is session-scoped
 * and intentionally untouched (see docs/architecture/persistence-contract.md).
 */
export function useSaveGame() {
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [lastAction, setLastAction] = useState<SaveAction>(null)
  const [lastError, setLastError] = useState<string | null>(null)

  const saveGame = useCallback(async (slotId: string, name: string) => {
    const world = useGameStore.getState().world
    if (!world || !saveSystem) return
    setIsSaving(true)
    setLastError(null)
    try {
      await saveSystem.saveToSlot(slotId, name, world)
      setLastAction('save')
    } catch (e) {
      setLastError((e as Error).message)
    } finally {
      setIsSaving(false)
    }
  }, [])

  const loadGame = useCallback(async (slotId: string) => {
    if (!saveSystem) return
    setIsLoading(true)
    setLastError(null)
    try {
      const world = await saveSystem.loadFromSlot(slotId)
      // Load replaces world only — race runtime slice stays at its current value.
      // The store reset-on-phase-transition logic clears it on the next weekend.
      useGameStore.setState({ world, lastRaceResults: null, lastSeasonEnd: null })
      setLastAction('load')
    } catch (e) {
      setLastError((e as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const listSaves = useCallback(async (): Promise<SlotInfo[]> => {
    if (!saveSystem) return []
    return saveSystem.listSlots()
  }, [])

  const deleteSave = useCallback(async (slotId: string) => {
    if (!saveSystem) return
    setLastError(null)
    try {
      await saveSystem.deleteSlot(slotId)
      setLastAction('delete')
    } catch (e) {
      setLastError((e as Error).message)
    }
  }, [])

  const exportSave = useCallback(async (slotId: string): Promise<string | null> => {
    if (!saveSystem) return null
    setLastError(null)
    try {
      const json = await saveSystem.exportSave(slotId)
      setLastAction('export')
      return json
    } catch (e) {
      setLastError((e as Error).message)
      return null
    }
  }, [])

  const importSave = useCallback(async (slotId: string, name: string, json: string) => {
    if (!saveSystem) return
    setIsSaving(true)
    setLastError(null)
    try {
      await saveSystem.importSave(slotId, name, json)
      setLastAction('import')
    } catch (e) {
      setLastError((e as Error).message)
    } finally {
      setIsSaving(false)
    }
  }, [])

  const status: SaveGameStatus = { isSaving, isLoading, lastAction, lastError }

  return {
    saveGame,
    loadGame,
    listSaves,
    deleteSave,
    exportSave,
    importSave,
    status,
    // Legacy shortcuts for existing call sites
    isLoading: isLoading || isSaving,
    error: lastError,
  }
}
