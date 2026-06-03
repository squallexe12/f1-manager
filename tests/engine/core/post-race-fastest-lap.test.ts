import { describe, it, expect } from 'vitest'
import { processPostRace, type RaceResult } from '@/engine/core/post-race-processor'
import { createPRNG } from '@/engine/core/prng'
import { initializeGame } from '@/engine/core/state-manager'

/**
 * Tests for the per-team fastestLapHistory append in processPostRace.
 * The team whose driver held the absolute race-wide fastest lap gets an
 * appended entry; all other teams keep their existing buffer untouched.
 * The buffer is FIFO-capped at 6 entries and respects the existing
 * lastProcessedRound idempotency guard.
 */

function makeFullResults(world: ReturnType<typeof initializeGame>, fastestLapDriverId: string): RaceResult[] {
  const activeIds = world.drivers
    .filter((d) => d.teamId && !d.isReserve && !d.isF2)
    .map((d) => d.id)
  return activeIds.map((id, i) => ({
    driverId: id,
    position: i + 1,
    dnf: false,
    fastestLap: id === fastestLapDriverId,
  }))
}

describe('processPostRace — fastestLapHistory append', () => {
  it('appends an entry for the team whose driver held the race-wide fastest lap', () => {
    const world = initializeGame('mclaren', 'golden-era', 1)
    const results = makeFullResults(world, 'norris')

    const update = processPostRace(
      world.teams, world.drivers, world.finance,
      [], {}, results,
      { driverId: 'norris', time: 78_421 },
      false, 1, world.gameState.season, 'mclaren', world.gameState.totalRaces, world.boardExpectations, createPRNG(5),
    )

    const mcl = update.teams.find((t) => t.id === 'mclaren')!
    expect(mcl.fastestLapHistory).toEqual([{ round: 1, lapMs: 78_421 }])
  })

  it('does not append for teams whose drivers did not hold the fastest lap', () => {
    const world = initializeGame('mclaren', 'golden-era', 1)
    const results = makeFullResults(world, 'verstappen')

    const update = processPostRace(
      world.teams, world.drivers, world.finance,
      [], {}, results,
      { driverId: 'verstappen', time: 78_100 },
      false, 1, world.gameState.season, 'mclaren', world.gameState.totalRaces, world.boardExpectations, createPRNG(5),
    )

    const mcl = update.teams.find((t) => t.id === 'mclaren')!
    const rb = update.teams.find((t) => t.id === 'red-bull')!
    expect(mcl.fastestLapHistory).toEqual([])
    expect(rb.fastestLapHistory).toEqual([{ round: 1, lapMs: 78_100 }])
  })

  it('FIFO-trims the buffer to the last 6 entries', () => {
    const world = initializeGame('mclaren', 'golden-era', 1)
    // Pre-populate McLaren with 6 entries.
    const seededTeams = world.teams.map((t) =>
      t.id === 'mclaren'
        ? {
            ...t,
            fastestLapHistory: [
              { round: 1, lapMs: 78_000 }, { round: 2, lapMs: 78_100 },
              { round: 3, lapMs: 78_200 }, { round: 4, lapMs: 78_300 },
              { round: 5, lapMs: 78_400 }, { round: 6, lapMs: 78_500 },
            ],
          }
        : t,
    )
    const results = makeFullResults(world, 'norris')

    const update = processPostRace(
      seededTeams, world.drivers, world.finance,
      [], {}, results,
      { driverId: 'norris', time: 78_600 },
      false, 7, world.gameState.season, 'mclaren', world.gameState.totalRaces, world.boardExpectations, createPRNG(5),
    )

    const mcl = update.teams.find((t) => t.id === 'mclaren')!
    expect(mcl.fastestLapHistory).toHaveLength(6)
    expect(mcl.fastestLapHistory[0].round).toBe(2) // round 1 dropped
    expect(mcl.fastestLapHistory[5]).toEqual({ round: 7, lapMs: 78_600 })
  })

  it('skips append when fastestLap is null', () => {
    const world = initializeGame('mclaren', 'golden-era', 1)
    const results = makeFullResults(world, 'norris')

    const update = processPostRace(
      world.teams, world.drivers, world.finance,
      [], {}, results,
      null,
      false, 1, world.gameState.season, 'mclaren', world.gameState.totalRaces, world.boardExpectations, createPRNG(5),
    )

    for (const team of update.teams) {
      expect(team.fastestLapHistory).toEqual([])
    }
  })

  it('respects the existing lastProcessedRound idempotency guard (no double-append)', () => {
    const world = initializeGame('mclaren', 'golden-era', 1)
    const results = makeFullResults(world, 'norris')
    const fastestLap = { driverId: 'norris', time: 78_421 }

    const firstPass = processPostRace(
      world.teams, world.drivers, world.finance,
      [], {}, results, fastestLap,
      false, 1, world.gameState.season, 'mclaren', world.gameState.totalRaces, world.boardExpectations, createPRNG(5),
    )

    const secondPass = processPostRace(
      firstPass.teams, firstPass.drivers, firstPass.finance,
      firstPass.narrativeEvents, firstPass.eventCooldowns,
      results, fastestLap,
      false, 1, world.gameState.season, 'mclaren', world.gameState.totalRaces, world.boardExpectations, createPRNG(5),
    )

    const first = firstPass.teams.find((t) => t.id === 'mclaren')!
    const second = secondPass.teams.find((t) => t.id === 'mclaren')!
    // Same round re-submitted — fastestLapHistory must not grow.
    expect(second.fastestLapHistory).toEqual(first.fastestLapHistory)
    expect(second.fastestLapHistory).toHaveLength(1)
  })
})
