import { describe, it, expect } from 'vitest'
import { initializeGame } from '@/engine/core/state-manager'
import { processPostRace, type RaceResult } from '@/engine/core/post-race-processor'
import { createPRNG } from '@/engine/core/prng'

type World = ReturnType<typeof initializeGame>

// Both player drivers take P1/P2; everyone else falls in behind. This meets
// the single-KPI position/podium sponsors in a single round so a bonus note
// (and therefore a cash bank) is guaranteed to fire.
function dominantResults(world: World, playerId: string): RaceResult[] {
  const players = world.drivers.filter(d => !d.isReserve && d.teamId === playerId)
  const others = world.drivers.filter(
    d => !d.isReserve && d.teamId !== null && d.teamId !== playerId,
  )
  return [...players, ...others].map((d, i) => ({
    driverId: d.id, position: i + 1, dnf: false, fastestLap: false,
  }))
}

describe('processPostRace — sponsor bonus cash banking', () => {
  it('starts a fresh game with zero banked bonuses for every team', () => {
    const world = initializeGame('mclaren', 'golden-era', 12345)
    for (const fs of Object.values(world.finance)) {
      expect(fs.bankedBonuses).toBe(0)
    }
  })

  it('banks bonus cash exactly when (and by how much) a paddock bonus note fires', () => {
    const world = initializeGame('mclaren', 'golden-era', 12345)
    const playerId = world.gameState.playerTeamId
    const results = dominantResults(world, playerId)
    const before = world.finance[playerId].bankedBonuses

    const update = processPostRace(
      world.teams, world.drivers, world.finance, world.narrativeEvents, {},
      results, null, false, 1, 1, playerId, world.gameState.totalRaces, createPRNG(1),
    )

    // The bonus note id is `sponsor-bonus-${sponsorId}-r${round}`.
    const firedIds = update.narrativeEvents
      .filter(e => e.id.startsWith('sponsor-bonus-') && e.id.endsWith('-r1'))
      .map(e => e.id.slice('sponsor-bonus-'.length, -'-r1'.length))
    const expectedDelta = update.finance[playerId].sponsors
      .filter(s => firedIds.includes(s.id))
      .reduce((sum, s) => sum + s.bonusValue, 0)

    const after = update.finance[playerId].bankedBonuses
    expect(after - before).toBe(expectedDelta)
    expect(after).toBeGreaterThan(before) // dominant P1/P2 meets >=1 single-KPI sponsor
  })

  it('does not double-bank when submitRaceResults double-fires for the same round', () => {
    const world = initializeGame('mclaren', 'golden-era', 12345)
    const playerId = world.gameState.playerTeamId
    const results = dominantResults(world, playerId)

    const first = processPostRace(
      world.teams, world.drivers, world.finance, world.narrativeEvents, {},
      results, null, false, 1, 1, playerId, world.gameState.totalRaces, createPRNG(1),
    )
    const bankedAfterFirst = first.finance[playerId].bankedBonuses
    expect(bankedAfterFirst).toBeGreaterThan(0)

    const second = processPostRace(
      first.teams, first.drivers, first.finance, first.narrativeEvents, {},
      results, null, false, 1, 1, playerId, world.gameState.totalRaces, createPRNG(1),
    )
    expect(second.finance[playerId].bankedBonuses).toBe(bankedAfterFirst)
  })

  it('never banks for AI teams (player-only sponsor economy)', () => {
    const world = initializeGame('mclaren', 'golden-era', 12345)
    const playerId = world.gameState.playerTeamId
    const aiId = world.teams.find(t => t.id !== playerId)!.id
    const results = dominantResults(world, playerId)
    const update = processPostRace(
      world.teams, world.drivers, world.finance, world.narrativeEvents, {},
      results, null, false, 1, 1, playerId, world.gameState.totalRaces, createPRNG(1),
    )
    expect(update.finance[aiId].bankedBonuses).toBe(0)
  })

  it('does not re-bank a sponsor whose KPI re-flips met->unmet->met within the same season', () => {
    const world = initializeGame('mclaren', 'golden-era', 12345)
    const playerId = world.gameState.playerTeamId
    const results = dominantResults(world, playerId)
    const totalRaces = world.gameState.totalRaces

    // Round 1, season 1: dominant → at least one sponsor banks its bonus.
    const r1 = processPostRace(
      world.teams, world.drivers, world.finance, world.narrativeEvents, {},
      results, null, false, 1, 1, playerId, totalRaces, createPRNG(1),
    )
    const banked1 = r1.finance[playerId].bankedBonuses
    expect(banked1).toBeGreaterThan(0)

    // Simulate an intervening round where those sponsors dropped to unmet
    // (e.g. constructorPosition slipped past target) — flip kpis.met=false but
    // preserve everything else (incl. any per-season paid marker). met is a
    // hard threshold test that genuinely oscillates round-to-round.
    const reflipped: typeof r1.finance = {
      ...r1.finance,
      [playerId]: {
        ...r1.finance[playerId],
        sponsors: r1.finance[playerId].sponsors.map(s => ({
          ...s,
          kpis: s.kpis.map(k => ({ ...k, met: false })),
        })),
      },
    }

    // Round 2, SAME season: empty results hold the season stats constant, so a
    // previously-met sponsor re-evaluates to met again with NO new sponsor
    // qualifying — isolating the re-flip. The per-season latch must block it.
    const r2 = processPostRace(
      r1.teams, r1.drivers, reflipped, r1.narrativeEvents, {},
      [], null, false, 2, 1, playerId, totalRaces, createPRNG(2),
    )
    expect(r2.finance[playerId].bankedBonuses).toBe(banked1) // banked once per season
  })

  it('re-banks the bonus in a new season (per-season paid latch re-arms)', () => {
    const world = initializeGame('mclaren', 'golden-era', 12345)
    const playerId = world.gameState.playerTeamId
    const results = dominantResults(world, playerId)
    const totalRaces = world.gameState.totalRaces

    const r1 = processPostRace(
      world.teams, world.drivers, world.finance, world.narrativeEvents, {},
      results, null, false, 1, 1, playerId, totalRaces, createPRNG(1),
    )
    const banked1 = r1.finance[playerId].bankedBonuses
    expect(banked1).toBeGreaterThan(0)

    // Enter season 2 with the sponsors currently unmet (KPIs reset each season).
    const nextSeason: typeof r1.finance = {
      ...r1.finance,
      [playerId]: {
        ...r1.finance[playerId],
        sponsors: r1.finance[playerId].sponsors.map(s => ({
          ...s,
          kpis: s.kpis.map(k => ({ ...k, met: false })),
        })),
      },
    }

    // Round 1 of SEASON 2: dominant → KPIs met again → bonus re-earned.
    const s2 = processPostRace(
      r1.teams, r1.drivers, nextSeason, r1.narrativeEvents, {},
      results, null, false, 1, 2, playerId, totalRaces, createPRNG(3),
    )
    expect(s2.finance[playerId].bankedBonuses).toBeGreaterThan(banked1) // re-earned
  })
})
