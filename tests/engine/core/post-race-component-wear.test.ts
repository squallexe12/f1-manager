import { describe, it, expect } from 'vitest'
import { processPostRace, type RaceResult } from '@/engine/core/post-race-processor'
import { createPRNG } from '@/engine/core/prng'
import { initializeGame } from '@/engine/core/state-manager'
import { WEAR_PER_RACE } from '@/engine/engineering/component-strategy'

describe('processPostRace — tickComponentWear', () => {
  it('accumulates fractional wear (WEAR_PER_RACE = 1 / 2.5) on every element', () => {
    const world = initializeGame('mclaren', 'golden-era', 1)
    const activeIds = world.drivers
      .filter((d) => d.teamId && !d.isReserve && !d.isF2)
      .map((d) => d.id)
    const results: RaceResult[] = activeIds.map((id, i) => ({
      driverId: id, position: i + 1, dnf: false, fastestLap: false,
    }))

    const update = processPostRace(
      world.teams, world.drivers, world.finance,
      [], {}, results, null,
      false, 1, world.gameState.season, 'mclaren', world.gameState.totalRaces, world.boardExpectations, createPRNG(5),
    )

    for (const team of update.teams) {
      const original = world.teams.find((t) => t.id === team.id)!
      for (const c of team.components) {
        const orig = original.components.find((oc) => oc.element === c.element)!
        expect(c.used).toBeCloseTo(orig.used + WEAR_PER_RACE, 10)
      }
    }
  })

  it('respects the lastProcessedRound idempotency guard (no double-tick)', () => {
    const world = initializeGame('mclaren', 'golden-era', 1)
    const activeIds = world.drivers
      .filter((d) => d.teamId && !d.isReserve && !d.isF2)
      .map((d) => d.id)
    const results: RaceResult[] = activeIds.map((id, i) => ({
      driverId: id, position: i + 1, dnf: false, fastestLap: false,
    }))

    const firstPass = processPostRace(
      world.teams, world.drivers, world.finance,
      [], {}, results, null,
      false, 1, world.gameState.season, 'mclaren', world.gameState.totalRaces, world.boardExpectations, createPRNG(5),
    )
    const secondPass = processPostRace(
      firstPass.teams, firstPass.drivers, firstPass.finance,
      firstPass.narrativeEvents, firstPass.eventCooldowns,
      results, null,
      false, 1, world.gameState.season, 'mclaren', world.gameState.totalRaces, world.boardExpectations, createPRNG(5),
    )

    // Re-submitting same round must not double-tick wear.
    for (const team of secondPass.teams) {
      const firstTeam = firstPass.teams.find((t) => t.id === team.id)!
      for (const c of team.components) {
        const firstC = firstTeam.components.find((fc) => fc.element === c.element)!
        expect(c.used).toBe(firstC.used)
      }
    }
  })
})
