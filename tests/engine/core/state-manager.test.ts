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
})

describe('advancePhase', () => {
  it('transitions from management to practice', () => {
    const state = initializeGame('mclaren', 'golden-era', 42)
    const next = advancePhase(state)
    expect(next.gameState.phase).toBe('practice')
  })
})
