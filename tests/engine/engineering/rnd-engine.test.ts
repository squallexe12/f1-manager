import { describe, it, expect } from 'vitest'
import { advanceRnD, unlockDependents, startUpgrade, pauseUpgrade, processRnDCycle } from '@/engine/engineering/rnd-engine'
import type { RndUpgrade } from '@/types/team'

function mockUpgrades(): RndUpgrade[] {
  return [
    {
      id: 'a', branch: 'chassis', name: 'Upgrade A', description: '', progress: 0,
      status: 'in-progress', cost: 1000, developmentRaces: 4,
      performanceDelta: { downforce: 3 }, prerequisiteIds: [],
    },
    {
      id: 'b', branch: 'chassis', name: 'Upgrade B', description: '', progress: 0,
      status: 'locked', cost: 2000, developmentRaces: 3,
      performanceDelta: { cornering: 2 }, prerequisiteIds: ['a'],
    },
    {
      id: 'c', branch: 'power-unit', name: 'Upgrade C', description: '', progress: 50,
      status: 'in-progress', cost: 1500, developmentRaces: 2,
      performanceDelta: { straightSpeed: 2 }, prerequisiteIds: [],
    },
  ]
}

describe('R&D engine', () => {
  it('in-progress upgrades advance by correct amount', () => {
    const upgrades = mockUpgrades()
    const result = advanceRnD(upgrades)
    // Upgrade A: 4 races to complete → 25% per race
    expect(result[0].progress).toBe(25)
    // Upgrade C: was at 50%, 2 races → 50% per race, now 100%
    expect(result[2].progress).toBe(100)
    expect(result[2].status).toBe('complete')
  })

  it('completed upgrades unlock dependents', () => {
    const upgrades = mockUpgrades()
    upgrades[0].status = 'complete'
    upgrades[0].progress = 100
    const result = unlockDependents(upgrades)
    expect(result[1].status).toBe('available')
  })

  it('paused upgrades preserve progress', () => {
    const upgrades = mockUpgrades()
    upgrades[0].progress = 60
    const paused = pauseUpgrade(upgrades, 'a')
    expect(paused[0].status).toBe('available')
    expect(paused[0].progress).toBe(60)

    // Resume
    const resumed = startUpgrade(paused, 'a')
    expect(resumed[0].status).toBe('in-progress')
    expect(resumed[0].progress).toBe(60)
  })

  it('processRnDCycle advances and unlocks in one step', () => {
    const upgrades: RndUpgrade[] = [
      {
        id: 'x', branch: 'active-aero', name: 'X', description: '', progress: 80,
        status: 'in-progress', cost: 1000, developmentRaces: 5,
        performanceDelta: { braking: 2 }, prerequisiteIds: [],
      },
      {
        id: 'y', branch: 'active-aero', name: 'Y', description: '', progress: 0,
        status: 'locked', cost: 1500, developmentRaces: 3,
        performanceDelta: { cornering: 3 }, prerequisiteIds: ['x'],
      },
    ]
    const result = processRnDCycle(upgrades)
    expect(result[0].status).toBe('complete')
    expect(result[1].status).toBe('available') // unlocked because x completed
  })
})
