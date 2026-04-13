import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSaveGame } from '@/hooks/use-save-game'
import { useGameStore } from '@/stores/game-store'
import { teardownPersistence } from '@/stores/persistence-setup'
import type { FullGameState } from '@/engine/core/state-manager'

function makeWorld(season: number): FullGameState {
  return { gameState: { season } } as unknown as FullGameState
}

describe('useSaveGame', () => {
  beforeEach(() => {
    teardownPersistence()
    useGameStore.setState({
      world: makeWorld(1),
      eventCooldowns: {},
      lastRaceResults: null,
      lastSeasonEnd: null,
    })
  })

  afterEach(() => {
    teardownPersistence()
  })

  it('reports isSaving while a save is in flight, then lastAction=save', async () => {
    const { result } = renderHook(() => useSaveGame())

    expect(result.current.status.isSaving).toBe(false)
    expect(result.current.status.lastAction).toBeNull()

    await act(async () => {
      await result.current.saveGame('ip05-slot', 'IP-05 Save')
    })

    expect(result.current.status.lastAction).toBe('save')
    expect(result.current.status.isSaving).toBe(false)
    expect(result.current.status.lastError).toBeNull()
  })

  it('loads a saved world and resets lastRaceResults / lastSeasonEnd', async () => {
    const { result } = renderHook(() => useSaveGame())

    await act(async () => {
      await result.current.saveGame('load-slot', 'To Load')
    })

    // Simulate stale UI state and a different world
    useGameStore.setState({
      world: makeWorld(99),
      lastRaceResults: [] as any,
      lastSeasonEnd: {} as any,
    })

    await act(async () => {
      await result.current.loadGame('load-slot')
    })

    const state = useGameStore.getState()
    expect(state.world?.gameState.season).toBe(1)
    expect(state.lastRaceResults).toBeNull()
    expect(state.lastSeasonEnd).toBeNull()
    expect(result.current.status.lastAction).toBe('load')
  })

  it('records an error when loading a missing slot', async () => {
    const { result } = renderHook(() => useSaveGame())

    await act(async () => {
      await result.current.loadGame('does-not-exist')
    })

    await waitFor(() => expect(result.current.status.lastError).not.toBeNull())
    expect(result.current.status.lastError).toMatch(/No save found/)
    expect(result.current.status.isLoading).toBe(false)
  })

  it('lists and deletes save slots', async () => {
    const { result } = renderHook(() => useSaveGame())

    await act(async () => {
      await result.current.saveGame('list-a', 'A')
      await result.current.saveGame('list-b', 'B')
    })

    let slots = await result.current.listSaves()
    const names = slots.map(s => s.name).sort()
    expect(names).toContain('A')
    expect(names).toContain('B')

    await act(async () => {
      await result.current.deleteSave('list-a')
    })

    slots = await result.current.listSaves()
    expect(slots.find(s => s.slotId === 'list-a')).toBeUndefined()
    expect(result.current.status.lastAction).toBe('delete')
  })

  it('exports and imports a save round-trip', async () => {
    const { result } = renderHook(() => useSaveGame())

    await act(async () => {
      await result.current.saveGame('export-src', 'Export Source')
    })

    let json: string | null = null
    await act(async () => {
      json = await result.current.exportSave('export-src')
    })
    expect(json).not.toBeNull()

    await act(async () => {
      await result.current.importSave('export-dst', 'Export Dest', json!)
    })

    await act(async () => {
      await result.current.loadGame('export-dst')
    })
    expect(useGameStore.getState().world?.gameState.season).toBe(1)
  })
})
