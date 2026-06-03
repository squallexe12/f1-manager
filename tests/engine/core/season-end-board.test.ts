import { describe, it, expect } from 'vitest'
import { processSeasonEndPhase } from '@/engine/core/orchestrator'
import { initializeGame } from '@/engine/core/state-manager'

function worldWithBoard(over: Partial<ReturnType<typeof initializeGame>['boardExpectations']>) {
  const w = initializeGame('mclaren', 'golden-era', 3)
  return { ...w, boardExpectations: { ...w.boardExpectations, ...over } }
}

describe('processSeasonEndPhase board verdict', () => {
  it('retains + advances the season when the mandate is met', () => {
    const base = worldWithBoard({})
    const teams = base.teams.map(t =>
      t.id === 'mclaren' ? { ...t, constructorPosition: 1 } : { ...t, constructorPosition: 5 })
    const world = { ...base, teams,
      boardExpectations: { ...base.boardExpectations,
        objectives: base.boardExpectations.objectives.map(o =>
          o.kind === 'constructorFinish' ? { ...o, target: 3 } : o) } }
    const out = processSeasonEndPhase(world)
    expect(out.result.boardVerdict?.verdict).toBe('retain')
    expect(out.world.gameState.season).toBe(world.gameState.season + 1)
    expect(out.world.boardExpectations.tenureStatus).toBe('active')
    expect(out.world.boardExpectations.objectives).toHaveLength(3) // re-derived
  })

  it('sacks (terminal, no advance) on a second consecutive miss', () => {
    const base = worldWithBoard({ warningsIssued: 1 })
    const teams = base.teams.map(t => ({ ...t, constructorPosition: t.id === 'mclaren' ? 11 : 1 }))
    const world = { ...base, teams,
      boardExpectations: { ...base.boardExpectations, warningsIssued: 1,
        objectives: base.boardExpectations.objectives.map(o =>
          o.kind === 'constructorFinish' ? { ...o, target: 2 }
          : o.kind === 'pointsTarget' ? { ...o, target: 9999 } : o) } }
    const out = processSeasonEndPhase(world)
    expect(out.result.boardVerdict?.verdict).toBe('sack')
    expect(out.world.boardExpectations.tenureStatus).toBe('sacked')
    expect(out.world.gameState.season).toBe(world.gameState.season) // NOT advanced
    expect(out.world.gameState.phase).toBe('season-end')
  })

  it('issues a warning + advances the season on a first miss', () => {
    const base = worldWithBoard({ warningsIssued: 0 })
    const teams = base.teams.map(t => ({ ...t, constructorPosition: t.id === 'mclaren' ? 11 : 1 }))
    const world = { ...base, teams,
      boardExpectations: { ...base.boardExpectations, warningsIssued: 0,
        objectives: base.boardExpectations.objectives.map(o =>
          o.kind === 'constructorFinish' ? { ...o, target: 2 }
          : o.kind === 'pointsTarget' ? { ...o, target: 9999 } : o) } }
    const out = processSeasonEndPhase(world)
    expect(out.result.boardVerdict?.verdict).toBe('warning')
    expect(out.world.gameState.season).toBe(world.gameState.season + 1) // advanced
    expect(out.world.boardExpectations.tenureStatus).toBe('warned')
    expect(out.world.boardExpectations.warningsIssued).toBe(1)          // carried
  })
})
