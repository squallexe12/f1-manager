import { describe, it, expect } from 'vitest'
import type { Team, ComponentElement, PendingComponentSwap } from '@/types/team'
import { electComponentSwap } from '@/engine/engineering/component-strategy'

function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 'mclaren', name: 'McLaren', shortName: 'MCL',
    color: '#FF8000', headquarters: 'Woking', powerUnitSupplier: 'mercedes',
    driverIds: ['norris', 'piastri'], reserveDriverId: null, staff: [],
    car: { downforce: 85, straightSpeed: 83, reliability: 80, tireManagement: 82, braking: 84, cornering: 86 },
    rndUpgrades: [],
    components: [
      { element: 'ice', used: 2, limit: 4, failureProbability: 0.02 },
      { element: 'turbo', used: 1, limit: 4, failureProbability: 0.02 },
      { element: 'mgu-k', used: 1, limit: 4, failureProbability: 0.02 },
      { element: 'ers-battery', used: 1, limit: 3, failureProbability: 0.01 },
      { element: 'gearbox', used: 2, limit: 4, failureProbability: 0.02 },
    ],
    windTunnelHoursUsed: 0, windTunnelHoursLimit: 300,
    cfdRunsUsed: 0, cfdRunsLimit: 2500,
    morale: 85, aiPersonality: null,
    constructorPoints: 0, constructorPosition: 1,
    previousConstructorPosition: 0, previousMorale: 85,
    seasonForm: [], lastProcessedRound: 0,
    ovrHistory: [], lastUpgradeRound: 0,
    fastestLapHistory: [], failureEvents: [],
    penaltiesTaken: 0, pendingComponentSwaps: [],
    ...overrides,
  }
}

describe('electComponentSwap', () => {
  it('appends a new swap entry to pendingComponentSwaps', () => {
    const team = makeTeam()
    const next = electComponentSwap(team, 'norris', 'ice', 5)
    expect(next.pendingComponentSwaps).toEqual([
      { driverId: 'norris', element: 'ice', electedRound: 5 },
    ])
  })

  it('is idempotent — re-electing the same driver+element does not duplicate', () => {
    const team = makeTeam({
      pendingComponentSwaps: [{ driverId: 'norris', element: 'ice', electedRound: 4 }],
    })
    const next = electComponentSwap(team, 'norris', 'ice', 5)
    expect(next.pendingComponentSwaps).toHaveLength(1)
    // First election wins — electedRound stays at 4 (no overwrite)
    expect(next.pendingComponentSwaps[0].electedRound).toBe(4)
  })

  it('allows different drivers to elect swaps for the same element', () => {
    const team = makeTeam({
      pendingComponentSwaps: [{ driverId: 'norris', element: 'ice', electedRound: 5 }],
    })
    const next = electComponentSwap(team, 'piastri', 'ice', 5)
    expect(next.pendingComponentSwaps).toHaveLength(2)
  })

  it('allows the same driver to elect swaps for different elements', () => {
    const team = makeTeam({
      pendingComponentSwaps: [{ driverId: 'norris', element: 'ice', electedRound: 5 }],
    })
    const next = electComponentSwap(team, 'norris', 'turbo', 5)
    expect(next.pendingComponentSwaps).toHaveLength(2)
  })

  it('returns the same team reference when the election is a no-op (idempotent)', () => {
    const team = makeTeam({
      pendingComponentSwaps: [{ driverId: 'norris', element: 'ice', electedRound: 5 }],
    })
    const next = electComponentSwap(team, 'norris', 'ice', 5)
    expect(next).toBe(team) // referential equality — no new object on no-op
  })
})
