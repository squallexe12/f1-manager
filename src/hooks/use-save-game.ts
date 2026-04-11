import { useState, useCallback } from 'react'
import { useGameStore } from '@/stores/game-store'
import { saveSystem } from '@/stores/persistence-setup'

/**
 * Hook for explicit save/load operations.
 * Reads world state imperatively via getState() to avoid re-render coupling.
 * Auto-save is handled separately by the persistence subscriber.
 */
export function useSaveGame() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const saveGame = useCallback(async (slotId: string, name: string) => {
    const world = useGameStore.getState().world
    if (!world || !saveSystem) return
    setIsLoading(true)
    try {
      await saveSystem.saveToSlot(slotId, name, world)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadGame = useCallback(async (slotId: string) => {
    if (!saveSystem) return
    setIsLoading(true)
    setError(null)
    try {
      const world = await saveSystem.loadFromSlot(slotId)
      useGameStore.setState({ world })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const listSaves = useCallback(async () => {
    if (!saveSystem) return []
    return saveSystem.listSlots()
  }, [])

  const deleteSave = useCallback(async (slotId: string) => {
    if (!saveSystem) return
    await saveSystem.deleteSlot(slotId)
  }, [])

  return { saveGame, loadGame, listSaves, deleteSave, isLoading, error }
}
