import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '@/stores/game-store'

describe('game-store — electComponentSwap', () => {
  beforeEach(() => {
    useGameStore.getState().initGame('mclaren', 'golden-era', 42)
  })

  it('appends a swap entry to the player team pendingComponentSwaps', () => {
    const initialRound = useGameStore.getState().world!.gameState.currentRound
    useGameStore.getState().electComponentSwap('norris', 'ice')
    const world = useGameStore.getState().world!
    const mcl = world.teams.find((t) => t.id === 'mclaren')!
    // electedRound reflects the current world round (`initializeGame` sets
    // `currentRound: 1` for a fresh game; assert against the live value
    // rather than a literal so the test survives any future change).
    expect(mcl.pendingComponentSwaps).toEqual([
      { driverId: 'norris', element: 'ice', electedRound: initialRound },
    ])
  })

  it('is idempotent — re-electing same driver+element does not double-queue', () => {
    useGameStore.getState().electComponentSwap('norris', 'ice')
    useGameStore.getState().electComponentSwap('norris', 'ice')
    const mcl = useGameStore.getState().world!.teams.find((t) => t.id === 'mclaren')!
    expect(mcl.pendingComponentSwaps).toHaveLength(1)
  })

  it('does nothing when world is null', () => {
    useGameStore.setState({ world: null })
    expect(() => useGameStore.getState().electComponentSwap('norris', 'ice')).not.toThrow()
  })
})
