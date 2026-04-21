import { describe, it, expect } from 'vitest'
import { getNextRaceBrief } from '@/engine/paddock/race-brief'
import { initializeGame } from '@/engine/core/state-manager'

describe('getNextRaceBrief', () => {
  it('returns the current round and calendar size', () => {
    const world = initializeGame('mclaren', 'golden-era', 1)
    const brief = getNextRaceBrief(world)!
    expect(brief.round).toBe(1)
    expect(brief.totalRounds).toBe(world.calendar.length)
    expect(brief.race).toEqual(world.calendar[0])
  })

  it('emits a session slot list for a standard weekend', () => {
    const world = initializeGame('mclaren', 'golden-era', 1)
    // Melbourne is not in the sprint set per CALENDAR config
    const brief = getNextRaceBrief(world)!
    expect(brief.sessions.map(s => s.key)).toEqual(['FP1', 'FP2', 'FP3', 'QUAL', 'RACE'])
  })

  it('emits a sprint-shaped session slot list for a sprint weekend', () => {
    const world = initializeGame('mclaren', 'golden-era', 1)
    // Find the first sprint round on the calendar
    const sprintRound = world.calendar.findIndex(r => r.isSprint) + 1
    const sprintWorld = {
      ...world,
      gameState: { ...world.gameState, currentRound: sprintRound },
    }
    const brief = getNextRaceBrief(sprintWorld)!
    expect(brief.sessions.map(s => s.key)).toContain('SPRINT')
    expect(brief.sessions.map(s => s.key)).toContain('SQ')
  })

  it('returns weather with sane bounds', () => {
    const world = initializeGame('mclaren', 'golden-era', 1)
    const brief = getNextRaceBrief(world)!
    expect(brief.weather.airTemp).toBeGreaterThan(0)
    expect(brief.weather.trackTemp).toBeGreaterThan(brief.weather.airTemp)
    expect(brief.weather.rainChance).toBeGreaterThanOrEqual(0)
    expect(brief.weather.rainChance).toBeLessThanOrEqual(100)
  })

  it('returns null once the calendar is exhausted', () => {
    const world = initializeGame('mclaren', 'golden-era', 1)
    const past = {
      ...world,
      gameState: { ...world.gameState, currentRound: world.calendar.length + 1 },
    }
    expect(getNextRaceBrief(past)).toBeNull()
  })
})
