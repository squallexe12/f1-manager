import type { RndUpgrade, CarPerformance } from '@/types/team'

/**
 * Advance R&D progress for in-progress upgrades.
 * Called once per management phase (between races).
 * Returns updated upgrades array.
 */
export function advanceRnD(upgrades: RndUpgrade[], rndEfficiency: number = 1.0): RndUpgrade[] {
  return upgrades.map(upgrade => {
    if (upgrade.status === 'in-progress') {
      const progressPerRace = (100 / upgrade.developmentRaces) * rndEfficiency
      const newProgress = Math.min(100, upgrade.progress + progressPerRace)

      if (newProgress >= 100) {
        return { ...upgrade, progress: 100, status: 'complete' as const }
      }
      return { ...upgrade, progress: newProgress }
    }
    return upgrade
  })
}

/**
 * After upgrades complete, check if any locked upgrades should become available.
 */
export function unlockDependents(upgrades: RndUpgrade[]): RndUpgrade[] {
  const completedIds = new Set(upgrades.filter(u => u.status === 'complete').map(u => u.id))

  return upgrades.map(upgrade => {
    if (upgrade.status === 'locked') {
      const allPrereqsMet = upgrade.prerequisiteIds.every(id => completedIds.has(id))
      if (allPrereqsMet) {
        return { ...upgrade, status: 'available' as const }
      }
    }
    return upgrade
  })
}

/**
 * Start researching an available upgrade.
 */
export function startUpgrade(upgrades: RndUpgrade[], upgradeId: string): RndUpgrade[] {
  return upgrades.map(upgrade => {
    if (upgrade.id === upgradeId && upgrade.status === 'available') {
      return { ...upgrade, status: 'in-progress' as const }
    }
    return upgrade
  })
}

/**
 * Pause an in-progress upgrade (preserves progress).
 */
export function pauseUpgrade(upgrades: RndUpgrade[], upgradeId: string): RndUpgrade[] {
  return upgrades.map(upgrade => {
    if (upgrade.id === upgradeId && upgrade.status === 'in-progress') {
      return { ...upgrade, status: 'available' as const }
    }
    return upgrade
  })
}

/**
 * Process a full R&D cycle: advance progress, then unlock dependents.
 */
export function processRnDCycle(upgrades: RndUpgrade[], efficiency: number = 1.0): RndUpgrade[] {
  const advanced = advanceRnD(upgrades, efficiency)
  return unlockDependents(advanced)
}
