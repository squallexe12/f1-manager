import 'fake-indexeddb/auto'
import { describe, expect, it, beforeEach } from 'vitest'
import { useGameStore } from '@/stores/game-store'

describe('evaluateApproachOffer', () => {
  beforeEach(() => {
    useGameStore.getState().initGame('mclaren', 'golden-era', 42)
  })

  it('returns null for a non-free-agent driver', () => {
    const world = useGameStore.getState().world!
    const contracted = world.drivers.find(d => d.teamId !== null)!
    const result = useGameStore.getState().evaluateApproachOffer(contracted.id, { salary: 10_000_000, termYears: 2 })
    expect(result).toBeNull()
  })

  it('returns null for a non-existent driver', () => {
    const result = useGameStore.getState().evaluateApproachOffer('nonexistent', { salary: 10_000_000, termYears: 2 })
    expect(result).toBeNull()
  })

  it('returns the engine result without mutating world', () => {
    const beforeWorld = useGameStore.getState().world
    const fa = beforeWorld!.drivers.find(d => d.teamId === null)!
    const result = useGameStore.getState().evaluateApproachOffer(fa.id, { salary: 100_000_000, termYears: 2 })
    expect(result).not.toBeNull()
    expect(result!.accepted).toBe(true)
    expect(useGameStore.getState().world).toBe(beforeWorld) // reference unchanged
  })
})

describe('signFreeAgent', () => {
  beforeEach(() => {
    useGameStore.getState().initGame('mclaren', 'golden-era', 42)
  })

  it('mutates world on accept', () => {
    const beforeWorld = useGameStore.getState().world!
    const fa = beforeWorld.drivers.find(d => d.teamId === null && !d.isF2)!
    const reserve = beforeWorld.drivers.find(d => d.teamId === beforeWorld.gameState.playerTeamId && d.isReserve)
    const result = useGameStore.getState().signFreeAgent(
      fa.id,
      { salary: 50_000_000, termYears: 2 }, // far above floor
      'RESERVE',
      reserve?.id ?? null,
    )

    expect(result.accepted).toBe(true)
    const afterWorld = useGameStore.getState().world!
    expect(afterWorld).not.toBe(beforeWorld)
    expect(afterWorld.drivers.find(d => d.id === fa.id)!.teamId).toBe(beforeWorld.gameState.playerTeamId)
  })

  it('does NOT mutate world on reject', () => {
    const beforeWorld = useGameStore.getState().world!
    const fa = beforeWorld.drivers.find(d => d.teamId === null && !d.isF2)!
    const reserve = beforeWorld.drivers.find(d => d.teamId === beforeWorld.gameState.playerTeamId && d.isReserve)
    const result = useGameStore.getState().signFreeAgent(
      fa.id,
      { salary: 1, termYears: 2 }, // far below floor
      'RESERVE',
      reserve?.id ?? null,
    )

    expect(result.accepted).toBe(false)
    expect(result.reason).toBeDefined()
    expect(useGameStore.getState().world).toBe(beforeWorld) // reference unchanged
  })

  it('rejects with phase-gate reason when not in management phase', () => {
    const world = useGameStore.getState().world!
    useGameStore.setState({
      world: { ...world, gameState: { ...world.gameState, phase: 'race' } },
    })
    const fa = world.drivers.find(d => d.teamId === null)!
    const result = useGameStore.getState().signFreeAgent(
      fa.id,
      { salary: 50_000_000, termYears: 2 },
      'RESERVE',
      null,
    )
    expect(result.accepted).toBe(false)
    expect(result.reason).toMatch(/management phase/i)
  })
})
