import { describe, it, expect } from 'vitest'
import { initializeGame } from '@/engine/core/state-manager'
import { processPostRace, type RaceResult } from '@/engine/core/post-race-processor'
import { createPRNG } from '@/engine/core/prng'
import type { FinanceState } from '@/types/finance'

function resultsFor(world: ReturnType<typeof initializeGame>): RaceResult[] {
  return world.drivers
    .filter(d => !d.isReserve && d.teamId !== null)
    .map((d, i) => ({ driverId: d.id, position: i + 1, dnf: false, fastestLap: false }))
}

function opsSpent(fs: FinanceState): number {
  return fs.budget.categories.find(c => c.name === 'Operations')!.spent
}

describe('processPostRace — per-race Operations spend idempotency', () => {
  it('debits Operations exactly once per round even if submitRaceResults double-fires', () => {
    const world = initializeGame('mclaren', 'golden-era', 12345)
    const playerId = world.gameState.playerTeamId
    const results = resultsFor(world)
    const totalRaces = world.gameState.totalRaces

    // First processing of round 1: input teams carry lastProcessedRound = 0.
    const first = processPostRace(
      world.teams, world.drivers, world.finance, world.narrativeEvents, {},
      results, null, false, 1, 1, playerId, totalRaces, createPRNG(1),
    )
    const opsAfterFirst = opsSpent(first.finance[playerId])
    expect(opsAfterFirst).toBe(2_500_000)

    // Re-fire the SAME round 1 against the already-processed output (teams now
    // carry lastProcessedRound = 1, exactly as a double-dispatch of
    // submitRaceResults would present them). The Operations debit must NOT repeat.
    const second = processPostRace(
      first.teams, first.drivers, first.finance, first.narrativeEvents, {},
      results, null, false, 1, 1, playerId, totalRaces, createPRNG(1),
    )
    expect(opsSpent(second.finance[playerId])).toBe(opsAfterFirst) // not 5_000_000
  })

  it('still debits Operations for a genuinely new round', () => {
    const world = initializeGame('mclaren', 'golden-era', 12345)
    const playerId = world.gameState.playerTeamId
    const results = resultsFor(world)
    const totalRaces = world.gameState.totalRaces

    const r1 = processPostRace(
      world.teams, world.drivers, world.finance, world.narrativeEvents, {},
      results, null, false, 1, 1, playerId, totalRaces, createPRNG(1),
    )
    const r2 = processPostRace(
      r1.teams, r1.drivers, r1.finance, r1.narrativeEvents, {},
      results, null, false, 2, 1, playerId, totalRaces, createPRNG(2),
    )
    expect(opsSpent(r2.finance[playerId])).toBe(5_000_000) // two rounds → two debits
  })
})
