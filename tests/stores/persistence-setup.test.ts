import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import {
  setupPersistence,
  teardownPersistence,
  saveSystem,
  getAutosaveStatus,
  subscribeAutosaveStatus,
} from '@/stores/persistence-setup'
import { useGameStore } from '@/stores/game-store'
import type { FullGameState } from '@/engine/core/state-manager'

function makeWorld(season: number): FullGameState {
  return { gameState: { season } } as unknown as FullGameState
}

describe('setupPersistence', () => {
  beforeEach(() => {
    teardownPersistence()
    useGameStore.setState({
      world: null,
      eventCooldowns: {},
      lastRaceResults: null,
      lastSeasonEnd: null,
    })
  })

  afterEach(() => {
    teardownPersistence()
    vi.restoreAllMocks()
  })

  it('does not fire autosave when world reference is unchanged', async () => {
    const spy = vi.spyOn(saveSystem!, 'autoSave').mockResolvedValue(undefined)
    setupPersistence()

    // Mutate a non-world field
    useGameStore.setState({ eventCooldowns: { foo: 1 } })
    await Promise.resolve()

    expect(spy).not.toHaveBeenCalled()
  })

  it('fires autosave when world changes', async () => {
    const spy = vi.spyOn(saveSystem!, 'autoSave').mockResolvedValue(undefined)
    setupPersistence()

    useGameStore.setState({ world: makeWorld(1) })
    await Promise.resolve()
    await Promise.resolve()

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('does not fire autosave when only raceRuntime changes', async () => {
    const spy = vi.spyOn(saveSystem!, 'autoSave').mockResolvedValue(undefined)
    setupPersistence()

    // Change only the raceRuntime slice (outside world — IP-04 Option A)
    useGameStore.getState().setRacePhase('running')
    useGameStore.getState().setRaceSimSpeed(2)
    await Promise.resolve()

    expect(spy).not.toHaveBeenCalled()
  })

  it('does not fire autosave when world becomes null', async () => {
    const spy = vi.spyOn(saveSystem!, 'autoSave').mockResolvedValue(undefined)
    useGameStore.setState({ world: makeWorld(1) })
    setupPersistence()
    spy.mockClear()

    useGameStore.setState({ world: null })
    await Promise.resolve()

    expect(spy).not.toHaveBeenCalled()
  })

  it('updates status on successful autosave', async () => {
    vi.spyOn(saveSystem!, 'autoSave').mockResolvedValue(undefined)
    const statuses: ReturnType<typeof getAutosaveStatus>[] = []
    const unsubscribe = subscribeAutosaveStatus((s) => statuses.push(s))
    setupPersistence()

    useGameStore.setState({ world: makeWorld(2) })
    // Wait for the microtask chain (autoSave → .then → notify)
    await new Promise(r => setTimeout(r, 0))

    const final = getAutosaveStatus()
    expect(final.saveCount).toBe(1)
    expect(final.lastSavedAt).not.toBeNull()
    expect(final.lastError).toBeNull()
    expect(statuses.length).toBeGreaterThanOrEqual(1)
    unsubscribe()
  })

  it('updates status on autosave failure', async () => {
    vi.spyOn(saveSystem!, 'autoSave').mockRejectedValue(new Error('disk full'))
    // Silence the dev-mode warn
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    setupPersistence()

    useGameStore.setState({ world: makeWorld(3) })
    await new Promise(r => setTimeout(r, 0))

    const final = getAutosaveStatus()
    expect(final.errorCount).toBe(1)
    expect(final.lastError?.message).toBe('disk full')
    expect(final.saveCount).toBe(0)
    warn.mockRestore()
  })

  it('ignores duplicate setupPersistence calls', async () => {
    const spy = vi.spyOn(saveSystem!, 'autoSave').mockResolvedValue(undefined)
    setupPersistence()
    setupPersistence()
    setupPersistence()

    useGameStore.setState({ world: makeWorld(4) })
    await Promise.resolve()
    await Promise.resolve()

    expect(spy).toHaveBeenCalledTimes(1)
  })
})
