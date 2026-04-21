import { describe, it, expect } from 'vitest'
import { generateWeeklySchedule } from '@/engine/paddock/factory-schedule'
import { initializeGame } from '@/engine/core/state-manager'

describe('generateWeeklySchedule', () => {
  it('returns exactly 5 entries ordered MON → FRI', () => {
    const world = initializeGame('mclaren', 'golden-era', 1)
    const schedule = generateWeeklySchedule(world)
    expect(schedule.map(s => s.when)).toEqual(['MON', 'TUE', 'WED', 'THU', 'FRI'])
  })

  it('uses the least-satisfied sponsor for Monday media day', () => {
    const world = initializeGame('mclaren', 'golden-era', 1)
    const player = world.finance['mclaren']
    const target = [...player.sponsors].sort((a, b) => a.satisfaction - b.satisfaction)[0]
    const schedule = generateWeeklySchedule(world)
    expect(schedule[0].label).toContain(target.name)
  })

  it('references the next race on Friday', () => {
    const world = initializeGame('mclaren', 'golden-era', 1)
    const schedule = generateWeeklySchedule(world)
    const firstRaceName = world.calendar[0].circuit.name.split(' ')[0]
    expect(schedule[4].label).toContain(firstRaceName)
  })

  it('falls back to planning labels when no sponsor/R&D is pending', () => {
    const world = initializeGame('mclaren', 'golden-era', 1)
    const emptyWorld = {
      ...world,
      finance: { ...world.finance, mclaren: { ...world.finance['mclaren'], sponsors: [] } },
      teams: world.teams.map(t =>
        t.id === 'mclaren' ? { ...t, rndUpgrades: [] } : t,
      ),
    }
    const schedule = generateWeeklySchedule(emptyWorld)
    expect(schedule[0].label).toMatch(/Commercial|planning/i)
    expect(schedule[1].label).toMatch(/R&D/i)
  })
})
