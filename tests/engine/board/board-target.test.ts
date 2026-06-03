import { describe, it, expect } from 'vitest'
import { deriveBoardObjectives } from '@/engine/board/board-target'
import { initializeGame } from '@/engine/core/state-manager'
import { SCENARIOS } from '@/data/scenarios'

describe('deriveBoardObjectives', () => {
  it('returns a 3-objective bundle keyed off car-OVR rank + scenario', () => {
    const world = initializeGame('mclaren', 'golden-era', 123)
    const scenario = SCENARIOS.find(s => s.id === 'golden-era')!
    const { objectives, rivalTeamId } = deriveBoardObjectives('mclaren', world.teams, scenario, 22)
    expect(objectives).toHaveLength(3)
    expect(objectives.map(o => o.kind)).toEqual(['constructorFinish', 'pointsTarget', 'beatRival'])
    expect(objectives[0].target).toBeGreaterThanOrEqual(1)
    expect(objectives[0].target).toBeLessThanOrEqual(11)
    expect(objectives[1].target).toBeGreaterThan(0)
    expect(rivalTeamId).not.toBe('')
    expect(rivalTeamId).not.toBe('mclaren')
    expect(objectives[2].label).toContain('Finish ahead of')
  })
  it('is deterministic for the same inputs', () => {
    const world = initializeGame('williams', 'rebuild', 7)
    const scenario = SCENARIOS.find(s => s.id === 'rebuild')!
    const a = deriveBoardObjectives('williams', world.teams, scenario, 22)
    const b = deriveBoardObjectives('williams', world.teams, scenario, 22)
    expect(a).toEqual(b)
  })
  it('clamps the target position to the 1..11 grid', () => {
    const world = initializeGame('audi', 'crisis', 5)
    const scenario = SCENARIOS.find(s => s.id === 'crisis')!
    const { objectives } = deriveBoardObjectives('audi', world.teams, scenario, 22)
    expect(objectives[0].target).toBeLessThanOrEqual(11)
    expect(objectives[0].target).toBeGreaterThanOrEqual(1)
  })
  it('scenario positionDelta shifts the target — golden-era is stricter than rebuild', () => {
    // Same teams/team; only the scenario modifier differs. Guards the
    // `+ exp.positionDelta` line: deleting it would make both targets equal.
    const world = initializeGame('mclaren', 'golden-era', 1)
    const golden = SCENARIOS.find(s => s.id === 'golden-era')!
    const rebuild = SCENARIOS.find(s => s.id === 'rebuild')!
    const strict = deriveBoardObjectives('mclaren', world.teams, golden, 22)
    const lenient = deriveBoardObjectives('mclaren', world.teams, rebuild, 22)
    expect(strict.objectives[0].target).toBeLessThan(lenient.objectives[0].target)
  })
})
