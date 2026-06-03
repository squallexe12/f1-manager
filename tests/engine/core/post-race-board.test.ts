import { describe, it, expect } from 'vitest'
import { processPostRace } from '@/engine/core/post-race-processor'
import { initializeGame } from '@/engine/core/state-manager'
import { createPRNG } from '@/engine/core/prng'
import type { RaceResult } from '@/engine/core/post-race-processor'

function p1Results(world: ReturnType<typeof initializeGame>): RaceResult[] {
  const playerDrivers = world.drivers.filter(d => d.teamId === world.gameState.playerTeamId && !d.isReserve)
  return world.drivers.filter(d => !d.isReserve).map((d, i) => ({
    driverId: d.id,
    position: playerDrivers.some(pd => pd.id === d.id) ? (i + 1) : (i + 5),
    dnf: false, fastestLap: false,
  }))
}

describe('processPostRace board confidence', () => {
  it('updates the player board confidence + stamps lastProcessedRound', () => {
    const world = initializeGame('mclaren', 'golden-era', 99)
    const results = p1Results(world)
    const update = processPostRace(
      world.teams, world.drivers, world.finance, world.narrativeEvents, {},
      results, null, false, 1, 1, 'mclaren', 22, world.boardExpectations,
      createPRNG(1),
    )
    expect(update.boardExpectations.lastProcessedRound).toBe(1)
    expect(update.boardExpectations.confidenceHistory).toHaveLength(1)
    expect(update.boardExpectations.objectives).toHaveLength(3)
  })

  it('is idempotent — a double-fire does not double-push confidence history', () => {
    const world = initializeGame('mclaren', 'golden-era', 99)
    const results = p1Results(world)
    const first = processPostRace(
      world.teams, world.drivers, world.finance, world.narrativeEvents, {},
      results, null, false, 1, 1, 'mclaren', 22, world.boardExpectations, createPRNG(1),
    )
    const second = processPostRace(
      world.teams, world.drivers, world.finance, world.narrativeEvents, {},
      results, null, false, 1, 1, 'mclaren', 22, first.boardExpectations, createPRNG(1),
    )
    expect(second.boardExpectations.confidenceHistory).toHaveLength(1)
    expect(second.boardExpectations.confidence).toBe(first.boardExpectations.confidence)
  })

  it('board recompute is deterministic for identical inputs', () => {
    const world = initializeGame('mclaren', 'golden-era', 5)
    const results = p1Results(world)
    const a = processPostRace(world.teams, world.drivers, world.finance, [], {}, results, null, false, 1, 1, 'mclaren', 22, world.boardExpectations, createPRNG(5))
    const b = processPostRace(world.teams, world.drivers, world.finance, [], {}, results, null, false, 1, 1, 'mclaren', 22, world.boardExpectations, createPRNG(5))
    expect(a.boardExpectations).toEqual(b.boardExpectations)
  })

  it('emits exactly one board note when the confidence band changes', () => {
    // Seed confidence is 50 (pressure). A dominant P1/P2 round-1 lifts a top
    // car (mclaren golden-era) into the secure band (>60) — a band crossing
    // that must push exactly one paddock note onto the returned feed.
    const world = initializeGame('mclaren', 'golden-era', 99)
    const results = p1Results(world)
    const update = processPostRace(
      world.teams, world.drivers, world.finance, world.narrativeEvents, {},
      results, null, false, 1, 1, 'mclaren', 22, world.boardExpectations, createPRNG(1),
    )
    expect(update.boardExpectations.confidence).toBeGreaterThan(60) // crossed into secure
    const boardNotes = update.narrativeEvents.filter(e => e.id === 'board-confidence-r1')
    expect(boardNotes).toHaveLength(1)
  })
})
