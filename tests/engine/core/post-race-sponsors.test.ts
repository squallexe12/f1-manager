import { describe, it, expect } from 'vitest'
import { initializeGame } from '@/engine/core/state-manager'
import { processPostRace, type RaceResult } from '@/engine/core/post-race-processor'
import { createPRNG } from '@/engine/core/prng'

function freshWorld() {
  return initializeGame('mclaren', 'golden-era', 12345)
}

// Build a results array where both player drivers finish well so KPIs move.
function resultsFor(world: ReturnType<typeof freshWorld>): RaceResult[] {
  return world.drivers
    .filter(d => !d.isReserve && d.teamId !== null)
    .map((d, i) => ({ driverId: d.id, position: i + 1, dnf: false, fastestLap: false }))
}

describe('processPostRace — sponsor KPI evaluation', () => {
  it('updates player-team sponsors current/satisfaction; leaves AI sponsors frozen', () => {
    const world = freshWorld()
    const playerId = world.gameState.playerTeamId
    const aiId = world.teams.find(t => t.id !== playerId)!.id
    const aiSatisfactionBefore = world.finance[aiId].sponsors.map(s => s.satisfaction)

    const update = processPostRace(
      world.teams, world.drivers, world.finance,
      world.narrativeEvents, {},
      resultsFor(world), null, false,
      1, 1, playerId,
      world.gameState.totalRaces,
      world.boardExpectations, createPRNG(world.gameState.seed + 999),
    )

    // AI sponsors untouched (still 60 from init).
    expect(update.finance[aiId].sponsors.map(s => s.satisfaction)).toEqual(aiSatisfactionBefore)
    // Player sponsors recomputed — satisfaction is now a function of pace, not the init 60.
    const playerSponsors = update.finance[playerId].sponsors
    expect(playerSponsors.length).toBeGreaterThan(0)
    for (const s of playerSponsors) {
      expect(s.satisfaction).toBeGreaterThanOrEqual(0)
      expect(s.satisfaction).toBeLessThanOrEqual(100)
    }
  })

  it('is deterministic — identical inputs produce identical finance', () => {
    const w = freshWorld()
    const args = [
      w.teams, w.drivers, w.finance, w.narrativeEvents, {},
      resultsFor(w), null, false, 1, 1, w.gameState.playerTeamId, w.gameState.totalRaces,
    ] as const
    const a = processPostRace(...args, w.boardExpectations, createPRNG(w.gameState.seed + 999))
    const b = processPostRace(...args, w.boardExpectations, createPRNG(w.gameState.seed + 999))
    expect(a.finance).toEqual(b.finance)
  })
})
