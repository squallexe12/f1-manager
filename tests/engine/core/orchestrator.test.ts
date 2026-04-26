import { describe, it, expect } from 'vitest'
import { initializeGame, type FullGameState } from '@/engine/core/state-manager'
import {
  advanceGamePhase,
  processPostRacePhase,
  processSeasonEndPhase,
} from '@/engine/core/orchestrator'
import type { RaceResult } from '@/engine/core/post-race-processor'

/**
 * Helper: deep-clone a FullGameState so we can verify no mutation.
 */
function snapshot(world: FullGameState): string {
  return JSON.stringify(world)
}

/**
 * Build a minimal set of race results for all 22 grid drivers.
 */
function buildRaceResults(world: FullGameState): RaceResult[] {
  const gridDrivers = world.drivers.filter(d => d.teamId !== null)
  return gridDrivers.map((d, i) => ({
    driverId: d.id,
    position: i + 1,
    dnf: false,
    fastestLap: i === 0,
  }))
}

describe('orchestrator — advanceGamePhase', () => {
  it('advances from management to practice without mutating input', () => {
    const world = initializeGame('mclaren', 'golden-era', 42)
    const before = snapshot(world)

    const next = advanceGamePhase(world)

    // Input not mutated
    expect(snapshot(world)).toBe(before)
    // Phase changed
    expect(next.gameState.phase).toBe('practice')
    // Round unchanged
    expect(next.gameState.currentRound).toBe(1)
  })

  it('advances through a full standard weekend flow', () => {
    let world = initializeGame('ferrari', 'golden-era', 100)
    expect(world.gameState.phase).toBe('management')

    world = advanceGamePhase(world) // management → practice
    expect(world.gameState.phase).toBe('practice')

    world = advanceGamePhase(world) // practice → qualifying
    expect(world.gameState.phase).toBe('qualifying')

    world = advanceGamePhase(world) // qualifying → race
    expect(world.gameState.phase).toBe('race')

    world = advanceGamePhase(world) // race → post-race
    expect(world.gameState.phase).toBe('post-race')

    world = advanceGamePhase(world) // post-race → next round management
    expect(world.gameState.phase).toBe('management')
    expect(world.gameState.currentRound).toBe(2)
  })

  it('advances through a sprint weekend flow', () => {
    let world = initializeGame('red-bull', 'golden-era', 200)
    const sprintRound = world.calendar.findIndex(r => r.isSprint) + 1
    expect(sprintRound).toBeGreaterThan(0)

    // Fast-forward to the sprint round
    world = {
      ...world,
      gameState: { ...world.gameState, currentRound: sprintRound, phase: 'management' },
    }

    world = advanceGamePhase(world) // management → practice
    expect(world.gameState.phase).toBe('practice')

    world = advanceGamePhase(world) // practice → sprint-qualifying
    expect(world.gameState.phase).toBe('sprint-qualifying')

    world = advanceGamePhase(world) // sprint-qualifying → sprint
    expect(world.gameState.phase).toBe('sprint')

    world = advanceGamePhase(world) // sprint → qualifying
    expect(world.gameState.phase).toBe('qualifying')

    world = advanceGamePhase(world) // qualifying → race
    expect(world.gameState.phase).toBe('race')

    world = advanceGamePhase(world) // race → post-race
    expect(world.gameState.phase).toBe('post-race')
  })

  it('transitions to season-end after the final round', () => {
    let world = initializeGame('mercedes', 'golden-era', 300)
    world = {
      ...world,
      gameState: { ...world.gameState, currentRound: world.gameState.totalRaces, phase: 'post-race' },
    }

    const next = advanceGamePhase(world)
    expect(next.gameState.phase).toBe('season-end')
  })

  it('runs management entry processing when entering management phase', () => {
    let world = initializeGame('mclaren', 'golden-era', 42)
    world = {
      ...world,
      gameState: { ...world.gameState, phase: 'post-race' },
    }

    const before = snapshot(world)
    const next = advanceGamePhase(world)

    // Input not mutated
    expect(snapshot(world)).toBe(before)
    // Now in management for round 2
    expect(next.gameState.phase).toBe('management')
    expect(next.gameState.currentRound).toBe(2)
    expect(next.teams).toBeDefined()
    expect(next.drivers).toBeDefined()
  })

  it('is deterministic — same seed produces identical output', () => {
    const worldA = initializeGame('mclaren', 'golden-era', 42)
    const worldB = initializeGame('mclaren', 'golden-era', 42)

    const stateA = { ...worldA, gameState: { ...worldA.gameState, phase: 'post-race' as const } }
    const stateB = { ...worldB, gameState: { ...worldB.gameState, phase: 'post-race' as const } }

    const nextA = advanceGamePhase(stateA)
    const nextB = advanceGamePhase(stateB)

    expect(snapshot(nextA)).toBe(snapshot(nextB))
  })
})

describe('orchestrator — processPostRacePhase', () => {
  it('processes race results without mutating input', () => {
    const world = initializeGame('ferrari', 'golden-era', 500)
    const cooldowns: Record<string, number> = {}
    const results = buildRaceResults(world)
    const before = snapshot(world)
    const cooldownsBefore = JSON.stringify(cooldowns)

    const update = processPostRacePhase(world, cooldowns, results, null, false)

    // Input not mutated
    expect(snapshot(world)).toBe(before)
    expect(JSON.stringify(cooldowns)).toBe(cooldownsBefore)
    // Output has expected shape
    expect(update.world).toBeDefined()
    expect(update.eventCooldowns).toBeDefined()
    expect(update.world.teams).toHaveLength(11)
    expect(update.world.drivers.length).toBeGreaterThanOrEqual(22)
  })

  it('updates driver season stats after race', () => {
    const world = initializeGame('mclaren', 'golden-era', 600)
    const results = buildRaceResults(world)
    const update = processPostRacePhase(world, {}, results, null, false)

    const winnerId = results[0].driverId
    const winner = update.world.drivers.find(d => d.id === winnerId)
    expect(winner).toBeDefined()
    expect(winner!.seasonStats.points).toBeGreaterThan(0)
  })

  it('handles sprint race results with reduced points', () => {
    const world = initializeGame('red-bull', 'golden-era', 700)
    const results = buildRaceResults(world)

    const update = processPostRacePhase(world, {}, results, null, true)

    const winnerId = results[0].driverId
    const winner = update.world.drivers.find(d => d.id === winnerId)
    expect(winner).toBeDefined()
    expect(winner!.seasonStats.points).toBeGreaterThan(0)
    // Sprint winner gets 8 points + 1 fastest lap bonus = 9, not 25+1
    expect(winner!.seasonStats.points).toBeLessThanOrEqual(9)
  })

  it('is deterministic — same inputs produce identical output', () => {
    const worldA = initializeGame('ferrari', 'golden-era', 500)
    const worldB = initializeGame('ferrari', 'golden-era', 500)
    const resultsA = buildRaceResults(worldA)
    const resultsB = buildRaceResults(worldB)

    const updateA = processPostRacePhase(worldA, {}, resultsA, null, false)
    const updateB = processPostRacePhase(worldB, {}, resultsB, null, false)

    expect(snapshot(updateA.world)).toBe(snapshot(updateB.world))
  })
})

describe('orchestrator — processSeasonEndPhase', () => {
  it('advances to next season without mutating input', () => {
    const world = initializeGame('williams', 'rebuild', 800)
    const before = snapshot(world)

    const { world: nextWorld, result } = processSeasonEndPhase(world)

    // Input not mutated
    expect(snapshot(world)).toBe(before)
    // Season incremented
    expect(nextWorld.gameState.season).toBe(2)
    expect(nextWorld.gameState.currentRound).toBe(1)
    expect(nextWorld.gameState.phase).toBe('management')
    // Result has expected shape
    expect(result.teams).toHaveLength(11)
    expect(result.prizeMoney).toBeDefined()
    expect(result.capBreaches).toBeDefined()
  })

  it('resets R&D upgrades for new season', () => {
    const world = initializeGame('mclaren', 'golden-era', 900)
    const { world: nextWorld } = processSeasonEndPhase(world)

    for (const team of nextWorld.teams) {
      expect(team.rndUpgrades.length).toBeGreaterThan(0)
    }
  })

  it('is deterministic — same seed produces identical output', () => {
    const worldA = initializeGame('williams', 'rebuild', 800)
    const worldB = initializeGame('williams', 'rebuild', 800)

    const resultA = processSeasonEndPhase(worldA)
    const resultB = processSeasonEndPhase(worldB)

    expect(snapshot(resultA.world)).toBe(snapshot(resultB.world))
  })
})

describe('orchestrator — Factory lastUpgradeRound stamping', () => {
  it('sets lastUpgradeRound on the player team when an R&D upgrade completes', () => {
    let world = initializeGame('mclaren', 'golden-era', 1)

    // Arrange: fast-forward an in-progress upgrade so the next cycle finishes it.
    // Pick the first available upgrade, move to in-progress at 99% so processRnDCycle
    // tips it over 100 and marks it complete.
    world = {
      ...world,
      teams: world.teams.map(t => {
        if (t.id !== 'mclaren') return t
        const rnd = t.rndUpgrades.map((u, i) =>
          i === 0 ? { ...u, status: 'in-progress' as const, progress: 99 } : u,
        )
        return { ...t, rndUpgrades: rnd }
      }),
      gameState: { ...world.gameState, phase: 'post-race', currentRound: 3 },
    }

    const next = advanceGamePhase(world)
    const mclaren = next.teams.find(t => t.id === 'mclaren')!
    expect(mclaren.lastUpgradeRound).toBe(4) // advanceGamePhase increments to round 4 in management
    expect(mclaren.rndUpgrades[0].status).toBe('complete')
  })

  it('does not bump lastUpgradeRound when no upgrade completes this cycle', () => {
    let world = initializeGame('mclaren', 'golden-era', 1)
    // Seed the existing marker so we can detect a stale overwrite.
    world = {
      ...world,
      teams: world.teams.map(t =>
        t.id === 'mclaren' ? { ...t, lastUpgradeRound: 2 } : t,
      ),
      gameState: { ...world.gameState, phase: 'post-race', currentRound: 5 },
    }

    const next = advanceGamePhase(world)
    const mclaren = next.teams.find(t => t.id === 'mclaren')!
    // No upgrade was close to done, so the marker stays at its prior value.
    expect(mclaren.lastUpgradeRound).toBe(2)
  })

  it('stamps lastUpgradeRound independently on AI teams that ship an upgrade', () => {
    let world = initializeGame('mclaren', 'golden-era', 1)

    world = {
      ...world,
      teams: world.teams.map(t => {
        if (t.id !== 'ferrari') return t
        const rnd = t.rndUpgrades.map((u, i) =>
          i === 0 ? { ...u, status: 'in-progress' as const, progress: 99 } : u,
        )
        return { ...t, rndUpgrades: rnd }
      }),
      gameState: { ...world.gameState, phase: 'post-race', currentRound: 6 },
    }

    const next = advanceGamePhase(world)
    const ferrari = next.teams.find(t => t.id === 'ferrari')!
    expect(ferrari.lastUpgradeRound).toBe(7)
  })
})

describe('orchestrator — management → practice (Phase 2 swap drain)', () => {
  it('drains pendingComponentSwaps and folds penalties into driver.nextRaceGridDrop', () => {
    let world = initializeGame('mclaren', 'golden-era', 42)
    // Place ICE at limit (4/4) so the next swap incurs a penalty.
    world = {
      ...world,
      teams: world.teams.map((t) => t.id === 'mclaren' ? {
        ...t,
        components: t.components.map((c) =>
          c.element === 'ice' ? { ...c, used: 4 } : c,
        ),
        pendingComponentSwaps: [
          { driverId: 'norris', element: 'ice' as const, electedRound: 1 },
        ],
      } : t),
    }

    const next = advanceGamePhase(world) // management → practice
    expect(next.gameState.phase).toBe('practice')

    // Pending swap drained
    const mcl = next.teams.find((t) => t.id === 'mclaren')!
    expect(mcl.pendingComponentSwaps).toEqual([])
    // Counter incremented
    expect(mcl.penaltiesTaken).toBe(1)
    // ICE used: 4 → 5
    expect(mcl.components.find((c) => c.element === 'ice')!.used).toBe(5)
    // Driver got the grid drop
    const norris = next.drivers.find((d) => d.id === 'norris')!
    expect(norris.nextRaceGridDrop).toBe(10)
  })

  it('does NOT increment penaltiesTaken when swap stays under limit', () => {
    let world = initializeGame('mclaren', 'golden-era', 42)
    // ICE at 2/4 — one swap → 3/4 (under limit, no penalty).
    world = {
      ...world,
      teams: world.teams.map((t) => t.id === 'mclaren' ? {
        ...t,
        pendingComponentSwaps: [
          { driverId: 'norris', element: 'ice' as const, electedRound: 1 },
        ],
      } : t),
    }
    const next = advanceGamePhase(world)
    const mcl = next.teams.find((t) => t.id === 'mclaren')!
    expect(mcl.penaltiesTaken).toBe(0)
    const norris = next.drivers.find((d) => d.id === 'norris')!
    expect(norris.nextRaceGridDrop).toBe(0)
  })

  it('only fires on management → practice (not on other transitions)', () => {
    let world = initializeGame('mclaren', 'golden-era', 42)
    world = {
      ...world,
      gameState: { ...world.gameState, phase: 'practice' },
      teams: world.teams.map((t) => t.id === 'mclaren' ? {
        ...t,
        components: t.components.map((c) =>
          c.element === 'ice' ? { ...c, used: 4 } : c,
        ),
        pendingComponentSwaps: [
          { driverId: 'norris', element: 'ice' as const, electedRound: 1 },
        ],
      } : t),
    }

    const next = advanceGamePhase(world) // practice → qualifying
    const mcl = next.teams.find((t) => t.id === 'mclaren')!
    // Queue must NOT be drained on this transition.
    expect(mcl.pendingComponentSwaps).toHaveLength(1)
    expect(mcl.penaltiesTaken).toBe(0)
  })
})
