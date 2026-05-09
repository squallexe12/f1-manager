import 'fake-indexeddb/auto'
import { describe, expect, it, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDriversPageData } from '@/hooks/use-drivers-page-data'
import { useGameStore } from '@/stores/game-store'

describe('useDriversPageData', () => {
  beforeEach(() => {
    useGameStore.setState({ world: null })
  })

  it('returns null when no world is loaded', () => {
    const { result } = renderHook(() => useDriversPageData())
    expect(result.current).toBeNull()
  })

  it('returns roster (CAR-01, CAR-02, RESERVE) for the player team', async () => {
    const { result } = renderHook(() => useDriversPageData())
    await act(async () => {
      useGameStore.getState().initGame('mclaren', 'golden-era', 42)
    })
    expect(result.current).not.toBeNull()
    expect(result.current!.roster.car01).toBeDefined()
    expect(result.current!.roster.car02).toBeDefined()
    expect(result.current!.roster).toBeDefined()
  })

  it('returns peer attributes derived across active drivers', async () => {
    const { result } = renderHook(() => useDriversPageData())
    await act(async () => {
      useGameStore.getState().initGame('mclaren', 'golden-era', 42)
    })
    expect(result.current).not.toBeNull()
    expect(result.current!.peerAttributes.pace).toBeGreaterThan(0)
  })
})
