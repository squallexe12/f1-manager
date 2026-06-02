import { describe, it, expect } from 'vitest'
import { initializeGame } from '@/engine/core/state-manager'
import { processSeasonEnd } from '@/engine/core/season-end-processor'

function worldWithUnhappyPlayerSponsor() {
  const world = initializeGame('mclaren', 'golden-era', 999)
  const playerId = world.gameState.playerTeamId
  const fs = world.finance[playerId]
  // Force the first sponsor below the at-risk floor (<30).
  const sponsors = fs.sponsors.map((s, i) => i === 0 ? { ...s, satisfaction: 10 } : s)
  return {
    ...world,
    finance: { ...world.finance, [playerId]: { ...fs, sponsors } },
  }
}

describe('processSeasonEnd — sponsor departures + backfill', () => {
  it('departs at-risk sponsors and backfills to the original count (player team)', () => {
    const world = worldWithUnhappyPlayerSponsor()
    const playerId = world.gameState.playerTeamId
    const before = world.finance[playerId].sponsors
    const atRiskId = before[0].id

    const result = processSeasonEnd(
      world.teams, world.drivers, world.finance,
      world.gameState.season, world.poachingAttempts, playerId,
    )

    const after = result.finance[playerId].sponsors
    expect(after.length).toBe(before.length) // backfilled to original count
    expect(after.some(s => s.id === atRiskId)).toBe(false) // departed
  })

  it('is deterministic — identical inputs produce identical sponsor rosters', () => {
    const world = worldWithUnhappyPlayerSponsor()
    const a = processSeasonEnd(world.teams, world.drivers, world.finance, world.gameState.season, world.poachingAttempts, world.gameState.playerTeamId)
    const b = processSeasonEnd(world.teams, world.drivers, world.finance, world.gameState.season, world.poachingAttempts, world.gameState.playerTeamId)
    expect(a.finance[world.gameState.playerTeamId].sponsors).toEqual(b.finance[world.gameState.playerTeamId].sponsors)
  })

  it('leaves non-player sponsors carried over unchanged', () => {
    const world = worldWithUnhappyPlayerSponsor()
    const aiId = world.teams.find(t => t.id !== world.gameState.playerTeamId)!.id
    const before = world.finance[aiId].sponsors
    const result = processSeasonEnd(world.teams, world.drivers, world.finance, world.gameState.season, world.poachingAttempts, world.gameState.playerTeamId)
    expect(result.finance[aiId].sponsors).toEqual(before)
  })
})
