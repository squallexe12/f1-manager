import { describe, expect, it } from 'vitest'
import { deriveContextTags } from '@/engine/media/context-tags'
import { initializeGame, type FullGameState } from '@/engine/core/state-manager'

// ---------------------------------------------------------------------------
// World builder helpers
// ---------------------------------------------------------------------------

function baseWorld(): FullGameState {
  return initializeGame('mclaren', 'rebuild', 1)
}

function withGameState(
  overrides: Partial<FullGameState['gameState']>,
): FullGameState {
  const w = baseWorld()
  return { ...w, gameState: { ...w.gameState, ...overrides } }
}

/** Return player driver ids for the given world (non-reserve, same team). */
function playerDriverIds(world: FullGameState): string[] {
  return world.drivers
    .filter(d => d.teamId === world.gameState.playerTeamId && !d.isReserve)
    .map(d => d.id)
}

/** Patch a driver in world.drivers by id. */
function patchDriver(
  world: FullGameState,
  driverId: string,
  patch: Partial<FullGameState['drivers'][number]>,
): FullGameState {
  return {
    ...world,
    drivers: world.drivers.map(d => d.id === driverId ? { ...d, ...patch } : d),
  }
}

// ---------------------------------------------------------------------------
// Group 1 — Round-based tags
// ---------------------------------------------------------------------------

describe('deriveContextTags — round-based', () => {
  it('emits season-opener on round 1', () => {
    const tags = deriveContextTags(withGameState({ currentRound: 1 }), 'thursday-fia')
    expect(tags).toContain('season-opener')
  })

  it('does NOT emit season-opener on round 2', () => {
    const tags = deriveContextTags(withGameState({ currentRound: 2 }), 'thursday-fia')
    expect(tags).not.toContain('season-opener')
  })

  it('emits season-finale on the last round (totalRaces)', () => {
    // Default calendar has 24 rounds; set currentRound to match totalRaces.
    const w = baseWorld()
    const tags = deriveContextTags(
      withGameState({ currentRound: w.gameState.totalRaces }),
      'thursday-fia',
    )
    expect(tags).toContain('season-finale')
  })

  it('does NOT emit season-finale one round before the last', () => {
    const w = baseWorld()
    const tags = deriveContextTags(
      withGameState({ currentRound: w.gameState.totalRaces - 1 }),
      'thursday-fia',
    )
    expect(tags).not.toContain('season-finale')
  })

  it('emits both season-opener and season-finale when currentRound === 1 === totalRaces', () => {
    // Edge case: the game state has totalRaces overridden to 1.
    // initializeGame sets totalRaces = CALENDAR.length (24); we override both.
    const w = baseWorld()
    const tags = deriveContextTags(
      { ...w, gameState: { ...w.gameState, currentRound: 1, totalRaces: 1 } },
      'thursday-fia',
    )
    expect(tags).toContain('season-opener')
    expect(tags).toContain('season-finale')
  })
})

// ---------------------------------------------------------------------------
// Group 2 — Race-result-based tags
// ---------------------------------------------------------------------------

describe('deriveContextTags — race result (post-race surface)', () => {
  it('emits after-podium when a player driver finished P1 on post-race surface', () => {
    const w = baseWorld()
    const [d1] = playerDriverIds(w)
    const patched = patchDriver(w, d1, { lastRaceResult: 1 })
    const tags = deriveContextTags(patched, 'post-race')
    expect(tags).toContain('after-podium')
  })

  it('emits after-podium when a player driver finished P3', () => {
    const w = baseWorld()
    const [d1] = playerDriverIds(w)
    const patched = patchDriver(w, d1, { lastRaceResult: 3 })
    const tags = deriveContextTags(patched, 'post-race')
    expect(tags).toContain('after-podium')
  })

  it('does NOT emit after-podium when best finish is P4', () => {
    const w = baseWorld()
    const [d1, d2] = playerDriverIds(w)
    let patched = patchDriver(w, d1, { lastRaceResult: 4 })
    patched = patchDriver(patched, d2, { lastRaceResult: 8 })
    const tags = deriveContextTags(patched, 'post-race')
    expect(tags).not.toContain('after-podium')
  })

  it('does NOT emit after-podium on thursday-fia surface even with P1', () => {
    const w = baseWorld()
    const [d1] = playerDriverIds(w)
    const patched = patchDriver(w, d1, { lastRaceResult: 1 })
    const tags = deriveContextTags(patched, 'thursday-fia')
    expect(tags).not.toContain('after-podium')
  })

  it('emits after-points when a player driver finished P4', () => {
    const w = baseWorld()
    const [d1] = playerDriverIds(w)
    const patched = patchDriver(w, d1, { lastRaceResult: 4 })
    const tags = deriveContextTags(patched, 'post-race')
    expect(tags).toContain('after-points')
  })

  it('emits after-points when a player driver finished P10', () => {
    const w = baseWorld()
    const [d1] = playerDriverIds(w)
    const patched = patchDriver(w, d1, { lastRaceResult: 10 })
    const tags = deriveContextTags(patched, 'post-race')
    expect(tags).toContain('after-points')
  })

  it('does NOT emit after-points for P11', () => {
    const w = baseWorld()
    const [d1, d2] = playerDriverIds(w)
    let patched = patchDriver(w, d1, { lastRaceResult: 11 })
    patched = patchDriver(patched, d2, { lastRaceResult: 15 })
    const tags = deriveContextTags(patched, 'post-race')
    expect(tags).not.toContain('after-points')
  })

  it('does NOT emit after-points for a podium (P1)', () => {
    // P1 → after-podium, not after-points
    const w = baseWorld()
    const [d1] = playerDriverIds(w)
    const patched = patchDriver(w, d1, { lastRaceResult: 1 })
    const tags = deriveContextTags(patched, 'post-race')
    expect(tags).not.toContain('after-points')
  })

  it('emits after-zero-points when both player drivers finished P11+', () => {
    const w = baseWorld()
    const [d1, d2] = playerDriverIds(w)
    let patched = patchDriver(w, d1, { lastRaceResult: 12 })
    patched = patchDriver(patched, d2, { lastRaceResult: 16 })
    const tags = deriveContextTags(patched, 'post-race')
    expect(tags).toContain('after-zero-points')
  })

  it('emits after-zero-points when both player drivers DNF (lastRaceResult === 21)', () => {
    const w = baseWorld()
    const [d1, d2] = playerDriverIds(w)
    let patched = patchDriver(w, d1, { lastRaceResult: 21 })
    patched = patchDriver(patched, d2, { lastRaceResult: 21 })
    const tags = deriveContextTags(patched, 'post-race')
    expect(tags).toContain('after-zero-points')
  })

  it('does NOT emit after-zero-points if one driver scored points', () => {
    const w = baseWorld()
    const [d1, d2] = playerDriverIds(w)
    let patched = patchDriver(w, d1, { lastRaceResult: 5 })
    patched = patchDriver(patched, d2, { lastRaceResult: 15 })
    const tags = deriveContextTags(patched, 'post-race')
    expect(tags).not.toContain('after-zero-points')
  })

  it('emits after-dnf when a player driver lastRaceResult is 21 (DNF sentinel)', () => {
    const w = baseWorld()
    const [d1] = playerDriverIds(w)
    const patched = patchDriver(w, d1, { lastRaceResult: 21 })
    const tags = deriveContextTags(patched, 'post-race')
    expect(tags).toContain('after-dnf')
  })

  it('does NOT emit after-dnf when lastRaceResult is null (no race yet)', () => {
    const w = baseWorld()
    // All drivers start with null lastRaceResult
    const tags = deriveContextTags(w, 'post-race')
    expect(tags).not.toContain('after-dnf')
  })

  it('does NOT emit after-dnf when lastRaceResult is 15 (classified finish)', () => {
    const w = baseWorld()
    const [d1] = playerDriverIds(w)
    const patched = patchDriver(w, d1, { lastRaceResult: 15 })
    const tags = deriveContextTags(patched, 'post-race')
    expect(tags).not.toContain('after-dnf')
  })
})

// ---------------------------------------------------------------------------
// Group 2b — Unreachable in v1: after-crash, after-pole, after-q1-exit, penalty-received
// ---------------------------------------------------------------------------

describe('deriveContextTags — v1-unreachable race result tags', () => {
  it('never emits after-crash (no incident data in world state)', () => {
    const tags = deriveContextTags(baseWorld(), 'post-race')
    expect(tags).not.toContain('after-crash')
  })

  it('never emits after-pole (no gridPosition in world state)', () => {
    const tags = deriveContextTags(baseWorld(), 'post-race')
    expect(tags).not.toContain('after-pole')
  })

  it('never emits after-q1-exit (no gridPosition in world state)', () => {
    const tags = deriveContextTags(baseWorld(), 'post-race')
    expect(tags).not.toContain('after-q1-exit')
  })

  it('never emits penalty-received (no appliedPenalties in world state)', () => {
    const tags = deriveContextTags(baseWorld(), 'post-race')
    expect(tags).not.toContain('penalty-received')
  })
})

// ---------------------------------------------------------------------------
// Group 3 — Teammate comparison tags (speaker-dependent)
// ---------------------------------------------------------------------------

describe('deriveContextTags — teammate comparison', () => {
  it('emits teammate-beat-you when speaker finished worse than teammate', () => {
    const w = baseWorld()
    const [d1, d2] = playerDriverIds(w)
    // d1 is speaker; d2 (teammate) beat them
    let patched = patchDriver(w, d1, { lastRaceResult: 8 })
    patched = patchDriver(patched, d2, { lastRaceResult: 4 })
    const tags = deriveContextTags(patched, 'post-race', d1)
    expect(tags).toContain('teammate-beat-you')
    expect(tags).not.toContain('beat-teammate')
  })

  it('emits beat-teammate when speaker finished better than teammate', () => {
    const w = baseWorld()
    const [d1, d2] = playerDriverIds(w)
    let patched = patchDriver(w, d1, { lastRaceResult: 3 })
    patched = patchDriver(patched, d2, { lastRaceResult: 7 })
    const tags = deriveContextTags(patched, 'post-race', d1)
    expect(tags).toContain('beat-teammate')
    expect(tags).not.toContain('teammate-beat-you')
  })

  it('does NOT emit teammate tags when speakerDriverId is undefined', () => {
    const w = baseWorld()
    const [d1, d2] = playerDriverIds(w)
    let patched = patchDriver(w, d1, { lastRaceResult: 8 })
    patched = patchDriver(patched, d2, { lastRaceResult: 4 })
    // No speakerDriverId
    const tags = deriveContextTags(patched, 'post-race')
    expect(tags).not.toContain('teammate-beat-you')
    expect(tags).not.toContain('beat-teammate')
  })

  it('does NOT emit teammate tags when either driver has no lastRaceResult', () => {
    const w = baseWorld()
    const [d1] = playerDriverIds(w)
    // Only patch d1; d2 stays null
    const patched = patchDriver(w, d1, { lastRaceResult: 5 })
    const tags = deriveContextTags(patched, 'post-race', d1)
    expect(tags).not.toContain('teammate-beat-you')
    expect(tags).not.toContain('beat-teammate')
  })

  it('does NOT emit teammate tags on thursday-fia surface', () => {
    const w = baseWorld()
    const [d1, d2] = playerDriverIds(w)
    let patched = patchDriver(w, d1, { lastRaceResult: 8 })
    patched = patchDriver(patched, d2, { lastRaceResult: 4 })
    const tags = deriveContextTags(patched, 'thursday-fia', d1)
    expect(tags).not.toContain('teammate-beat-you')
    expect(tags).not.toContain('beat-teammate')
  })
})

// ---------------------------------------------------------------------------
// Group 4 — Driver state tags
// ---------------------------------------------------------------------------

describe('deriveContextTags — driver state', () => {
  it('emits driver-mood-low when speaker motivation < 35', () => {
    const w = baseWorld()
    const [d1] = playerDriverIds(w)
    const patched = patchDriver(w, d1, { mood: { motivation: 20, frustration: 80, confidence: 30 } })
    const tags = deriveContextTags(patched, 'thursday-fia', d1)
    expect(tags).toContain('driver-mood-low')
    expect(tags).not.toContain('driver-mood-high')
  })

  it('emits driver-mood-high when speaker motivation > 75', () => {
    const w = baseWorld()
    const [d1] = playerDriverIds(w)
    const patched = patchDriver(w, d1, { mood: { motivation: 90, frustration: 10, confidence: 88 } })
    const tags = deriveContextTags(patched, 'thursday-fia', d1)
    expect(tags).toContain('driver-mood-high')
    expect(tags).not.toContain('driver-mood-low')
  })

  it('emits neither mood tag when motivation is 50 (mid-range)', () => {
    const w = baseWorld()
    const [d1] = playerDriverIds(w)
    const patched = patchDriver(w, d1, { mood: { motivation: 50, frustration: 40, confidence: 50 } })
    const tags = deriveContextTags(patched, 'thursday-fia', d1)
    expect(tags).not.toContain('driver-mood-low')
    expect(tags).not.toContain('driver-mood-high')
  })

  it('emits neither mood tag when speakerDriverId is undefined', () => {
    const w = baseWorld()
    const [d1] = playerDriverIds(w)
    const patched = patchDriver(w, d1, { mood: { motivation: 20, frustration: 80, confidence: 30 } })
    const tags = deriveContextTags(patched, 'thursday-fia')
    expect(tags).not.toContain('driver-mood-low')
    expect(tags).not.toContain('driver-mood-high')
  })

  it('emits contract-expiring when speaker driver termEndSeason === 1', () => {
    const w = baseWorld()
    const [d1] = playerDriverIds(w)
    const patched = patchDriver(w, d1, {
      contract: { salary: 5_000_000, termEndSeason: 1, performanceBonuses: [], releaseClause: null },
    })
    const tags = deriveContextTags(patched, 'thursday-fia', d1)
    expect(tags).toContain('contract-expiring')
  })

  it('does NOT emit contract-expiring when termEndSeason is 2', () => {
    const w = baseWorld()
    const [d1] = playerDriverIds(w)
    const patched = patchDriver(w, d1, {
      contract: { salary: 5_000_000, termEndSeason: 2, performanceBonuses: [], releaseClause: null },
    })
    const tags = deriveContextTags(patched, 'thursday-fia', d1)
    expect(tags).not.toContain('contract-expiring')
  })

  it('does NOT emit contract-expiring when contract is null', () => {
    const w = baseWorld()
    const [d1] = playerDriverIds(w)
    const patched = patchDriver(w, d1, { contract: null })
    const tags = deriveContextTags(patched, 'thursday-fia', d1)
    expect(tags).not.toContain('contract-expiring')
  })

  it('does NOT emit contract-expiring when speakerDriverId is undefined', () => {
    const w = baseWorld()
    const [d1] = playerDriverIds(w)
    const patched = patchDriver(w, d1, {
      contract: { salary: 5_000_000, termEndSeason: 1, performanceBonuses: [], releaseClause: null },
    })
    const tags = deriveContextTags(patched, 'thursday-fia')
    expect(tags).not.toContain('contract-expiring')
  })
})

// ---------------------------------------------------------------------------
// Group 4b — Unreachable in v1: rumored-poach
// ---------------------------------------------------------------------------

describe('deriveContextTags — v1-unreachable driver state tags', () => {
  it('never emits rumored-poach (PoachingAttempt targets pit-crew staff, not drivers)', () => {
    const tags = deriveContextTags(baseWorld(), 'thursday-fia')
    expect(tags).not.toContain('rumored-poach')
  })
})

// ---------------------------------------------------------------------------
// Group 5 — Finance tags
// ---------------------------------------------------------------------------

describe('deriveContextTags — finance', () => {
  it('emits budget-cap-pressure when spent > 90% of cap and >= 5 rounds remain', () => {
    const w = withGameState({ currentRound: 10, totalRaces: 22 }) // 12 rounds remain
    const playerTeamId = w.gameState.playerTeamId
    const patched: FullGameState = {
      ...w,
      finance: {
        ...w.finance,
        [playerTeamId]: {
          ...w.finance[playerTeamId],
          budget: {
            ...w.finance[playerTeamId].budget,
            cap: 215_000_000,
            totalSpent: 200_000_000, // ~93% spent
          },
        },
      },
    }
    const tags = deriveContextTags(patched, 'thursday-fia')
    expect(tags).toContain('budget-cap-pressure')
  })

  it('does NOT emit budget-cap-pressure when remaining > 10% of cap', () => {
    const w = withGameState({ currentRound: 10, totalRaces: 22 })
    const playerTeamId = w.gameState.playerTeamId
    const patched: FullGameState = {
      ...w,
      finance: {
        ...w.finance,
        [playerTeamId]: {
          ...w.finance[playerTeamId],
          budget: {
            ...w.finance[playerTeamId].budget,
            cap: 215_000_000,
            totalSpent: 100_000_000, // ~46% spent — plenty left
          },
        },
      },
    }
    const tags = deriveContextTags(patched, 'thursday-fia')
    expect(tags).not.toContain('budget-cap-pressure')
  })

  it('does NOT emit budget-cap-pressure when < 5 rounds remain even if over 90%', () => {
    const w = withGameState({ currentRound: 19, totalRaces: 22 }) // 3 rounds remain
    const playerTeamId = w.gameState.playerTeamId
    const patched: FullGameState = {
      ...w,
      finance: {
        ...w.finance,
        [playerTeamId]: {
          ...w.finance[playerTeamId],
          budget: {
            ...w.finance[playerTeamId].budget,
            cap: 215_000_000,
            totalSpent: 200_000_000,
          },
        },
      },
    }
    const tags = deriveContextTags(patched, 'thursday-fia')
    expect(tags).not.toContain('budget-cap-pressure')
  })
})

// ---------------------------------------------------------------------------
// Group 5b — Unreachable in v1: prestige-rising, prestige-falling
// ---------------------------------------------------------------------------

describe('deriveContextTags — v1-unreachable finance tags', () => {
  it('never emits prestige-rising (no prestige history field in FinanceState)', () => {
    const tags = deriveContextTags(baseWorld(), 'thursday-fia')
    expect(tags).not.toContain('prestige-rising')
  })

  it('never emits prestige-falling (no prestige history field in FinanceState)', () => {
    const tags = deriveContextTags(baseWorld(), 'thursday-fia')
    expect(tags).not.toContain('prestige-falling')
  })
})

// ---------------------------------------------------------------------------
// Group 6 — Regulation tag
// ---------------------------------------------------------------------------

describe('deriveContextTags — v1-unreachable regulation tag', () => {
  it('never emits reg-controversy (no controversy field on RegulationChange/TechnicalDirective)', () => {
    const tags = deriveContextTags(baseWorld(), 'thursday-fia')
    expect(tags).not.toContain('reg-controversy')
  })
})

// ---------------------------------------------------------------------------
// Group 7 — Calendar/home-race tag
// ---------------------------------------------------------------------------

describe('deriveContextTags — home-race', () => {
  it('emits home-race when circuit country matches speaker driver nationality (exact)', () => {
    // Piastri is Australian; Melbourne (round 1) is in Australia
    const w = withGameState({ currentRound: 1 })
    // Find Piastri's id
    const piastri = w.drivers.find(d => d.id === 'piastri')
    expect(piastri).toBeDefined()
    const tags = deriveContextTags(w, 'thursday-fia', 'piastri')
    expect(tags).toContain('home-race')
  })

  it('emits home-race for British driver at Silverstone (Great Britain → British normalization)', () => {
    // Silverstone is round 12 in the 2026 calendar
    const silverstone = baseWorld().calendar.findIndex(r => r.circuit.id === 'silverstone')
    expect(silverstone).toBeGreaterThan(-1)
    const round = silverstone + 1
    const w = withGameState({ currentRound: round })
    // norris is British — should match Great Britain via normalization
    const tags = deriveContextTags(w, 'thursday-fia', 'norris')
    expect(tags).toContain('home-race')
  })

  it('emits home-race for Dutch driver at Zandvoort (Netherlands → Dutch)', () => {
    const zandvoortIdx = baseWorld().calendar.findIndex(r => r.circuit.id === 'zandvoort')
    const round = zandvoortIdx + 1
    const w = withGameState({ currentRound: round })
    const tags = deriveContextTags(w, 'thursday-fia', 'verstappen')
    expect(tags).toContain('home-race')
  })

  it('emits home-race for Monegasque driver at Monaco (Monaco → Monegasque)', () => {
    const monacoIdx = baseWorld().calendar.findIndex(r => r.circuit.id === 'monaco')
    const round = monacoIdx + 1
    const w = withGameState({ currentRound: round })
    const tags = deriveContextTags(w, 'thursday-fia', 'leclerc')
    expect(tags).toContain('home-race')
  })

  it('does NOT emit home-race when driver nationality does not match circuit country', () => {
    // Norris (British) at Melbourne (Australia)
    const w = withGameState({ currentRound: 1 })
    const tags = deriveContextTags(w, 'thursday-fia', 'norris')
    expect(tags).not.toContain('home-race')
  })

  it('does NOT emit home-race when speakerDriverId is undefined', () => {
    const w = withGameState({ currentRound: 1 })
    const tags = deriveContextTags(w, 'thursday-fia')
    expect(tags).not.toContain('home-race')
  })
})

// ---------------------------------------------------------------------------
// Return type: array, no duplicates
// ---------------------------------------------------------------------------

describe('deriveContextTags — return shape', () => {
  it('returns an array', () => {
    const tags = deriveContextTags(baseWorld(), 'thursday-fia')
    expect(Array.isArray(tags)).toBe(true)
  })

  it('contains no duplicate tags', () => {
    const w = withGameState({ currentRound: 1 })
    const tags = deriveContextTags(w, 'thursday-fia')
    const unique = new Set(tags)
    expect(unique.size).toBe(tags.length)
  })
})
