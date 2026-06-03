import { describe, it, expect } from 'vitest'
import { initializeGame, advancePhase } from '@/engine/core/state-manager'

describe('initializeGame', () => {
  it('creates valid initial state for a team and scenario', () => {
    const state = initializeGame('mclaren', 'golden-era', 42)
    expect(state.gameState.playerTeamId).toBe('mclaren')
    expect(state.gameState.scenario).toBe('golden-era')
    expect(state.gameState.season).toBe(1)
    expect(state.gameState.currentRound).toBe(1)
    expect(state.gameState.phase).toBe('management')
    expect(state.teams).toHaveLength(11)
    expect(state.drivers.length).toBeGreaterThanOrEqual(22)
  })

  it('applies scenario modifiers to player team', () => {
    const golden = initializeGame('mclaren', 'golden-era', 42)
    const rebuild = initializeGame('mclaren', 'rebuild', 42)
    const goldenTeam = golden.teams.find(t => t.id === 'mclaren')!
    const rebuildTeam = rebuild.teams.find(t => t.id === 'mclaren')!
    expect(goldenTeam.morale).toBeGreaterThan(rebuildTeam.morale)
  })

  it('initialises every team with the 5-element 2026 PU allocation', () => {
    const state = initializeGame('mclaren', 'golden-era', 42)
    const expected = ['ice', 'turbo', 'mgu-k', 'ers-battery', 'gearbox']
    for (const team of state.teams) {
      expect(team.components.map(c => c.element)).toEqual(expected)
      for (const c of team.components) {
        expect(c.used).toBe(0)
        expect(c.limit).toBeGreaterThan(0)
      }
    }
  })
})

describe('createInitialFinance — sponsor allocation', () => {
  it('gives every team at least one sponsor (no shared-pool starvation)', () => {
    const state = initializeGame('mclaren', 'golden-era', 42)
    for (const team of state.teams) {
      expect(
        state.finance[team.id].sponsors.length,
        `team ${team.id} should start with >=1 sponsor`,
      ).toBeGreaterThan(0)
    }
  })

  it('gives a low-prestige team a multi-sponsor set even when premium teams allocate first', () => {
    // 'audi' defaults to prestige 'C' and sits late in the TEAMS order. Under
    // the old shared-pool logic the premium teams drained every minor template
    // before audi was reached, leaving it (and ~5 others) with zero sponsors.
    const state = initializeGame('mclaren', 'golden-era', 42)
    expect(state.finance['audi'].sponsors.length).toBeGreaterThanOrEqual(2)
  })

  it('keeps initialization deterministic for a fixed seed', () => {
    const a = initializeGame('mclaren', 'golden-era', 42)
    const b = initializeGame('mclaren', 'golden-era', 42)
    expect(a.finance).toEqual(b.finance)
  })
})

describe('advancePhase', () => {
  it('transitions from management to practice', () => {
    const state = initializeGame('mclaren', 'golden-era', 42)
    const next = advancePhase(state)
    expect(next.gameState.phase).toBe('practice')
  })
})

describe('initializeGame board expectations', () => {
  it('seeds a 3-objective mandate at neutral confidence', () => {
    const w = initializeGame('ferrari', 'golden-era', 42)
    expect(w.boardExpectations.objectives).toHaveLength(3)
    expect(w.boardExpectations.objectives.map(o => o.kind))
      .toEqual(['constructorFinish', 'pointsTarget', 'beatRival'])
    expect(w.boardExpectations.confidence).toBe(50)
    expect(w.boardExpectations.tenureStatus).toBe('active')
    expect(w.boardExpectations.verdict).toBeNull()
    expect(w.boardExpectations.warningsIssued).toBe(0)
    expect(w.boardExpectations.lastProcessedRound).toBe(-1)
    // rival must be a real team on the grid, and never the player
    expect(w.teams.map(t => t.id)).toContain(w.boardExpectations.rivalTeamId)
    expect(w.boardExpectations.rivalTeamId).not.toBe('ferrari')
  })
})
