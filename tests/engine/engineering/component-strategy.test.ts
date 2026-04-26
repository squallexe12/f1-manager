import { describe, it, expect } from 'vitest'
import type { Team, ComponentElement, PendingComponentSwap } from '@/types/team'
import {
  electComponentSwap,
  applyPendingSwaps,
  tickComponentWear,
  projectedGridLossIfElectedNow,
  componentSwapRows,
} from '@/engine/engineering/component-strategy'
import type { Driver } from '@/types/driver'

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

function makeDriver(id: string, teamId: string, overrides: Partial<Driver> = {}): Driver {
  // No `as Driver` cast — build a fully-typed Driver so future field
  // additions break loudly. Read src/types/driver.ts to confirm the shape
  // before changing this fixture.
  const driver: Driver = {
    id,
    firstName: id,
    lastName: id,
    shortName: id.toUpperCase().slice(0, 3),
    nationality: 'GB',
    age: 25,
    teamId,
    attributes: {
      pace: 80,
      racecraft: 80,
      experience: 70,
      mentality: 80,
      marketability: 70,
      developmentPotential: 70,
    },
    mood: { motivation: 70, frustration: 20, confidence: 70 },
    contract: null,
    seasonStats: {
      points: 0,
      wins: 0,
      podiums: 0,
      poles: 0,
      dnfs: 0,
      penalties: 0,
      bestFinish: 0,
      averageFinish: 0,
      lastProcessedRound: 0,
    },
    rivalries: [],
    peakAge: 28,
    declineRate: 1,
    isReserve: false,
    isF2: false,
    form: [],
    lastRaceResult: null,
    penaltyPoints: [],
    warningsThisSeason: 0,
    nextRaceGridDrop: 0,
    banUntilRound: null,
  }
  return { ...driver, ...overrides }
}

describe('applyPendingSwaps', () => {
  it('returns the same team and empty penalty map when queue is empty', () => {
    const team = makeTeam()
    const drivers = [makeDriver('norris', 'mclaren'), makeDriver('piastri', 'mclaren')]
    const result = applyPendingSwaps(team, drivers, 5)
    expect(result.team.pendingComponentSwaps).toEqual([])
    expect(result.gridPenaltyByDriver).toEqual({})
    expect(result.team.penaltiesTaken).toBe(0)
  })

  it('increments components[el].used per drained swap', () => {
    const team = makeTeam({
      pendingComponentSwaps: [
        { driverId: 'norris', element: 'ice', electedRound: 5 },
        { driverId: 'piastri', element: 'turbo', electedRound: 5 },
      ],
    })
    const drivers = [makeDriver('norris', 'mclaren'), makeDriver('piastri', 'mclaren')]
    const result = applyPendingSwaps(team, drivers, 5)
    expect(result.team.components.find((c) => c.element === 'ice')!.used).toBe(3) // was 2
    expect(result.team.components.find((c) => c.element === 'turbo')!.used).toBe(2) // was 1
    expect(result.team.pendingComponentSwaps).toEqual([])
  })

  it('does not trigger penalty when post-increment used <= limit', () => {
    const team = makeTeam({
      pendingComponentSwaps: [{ driverId: 'norris', element: 'ice', electedRound: 5 }],
    })
    // ICE was 2/4; one swap → 3/4 (under limit, no penalty)
    const drivers = [makeDriver('norris', 'mclaren')]
    const result = applyPendingSwaps(team, drivers, 5)
    expect(result.gridPenaltyByDriver).toEqual({})
    expect(result.team.penaltiesTaken).toBe(0)
  })

  it('triggers penalty when post-increment used > limit', () => {
    const team = makeTeam({
      components: [
        { element: 'ice', used: 4, limit: 4, failureProbability: 0.02 },
        { element: 'turbo', used: 1, limit: 4, failureProbability: 0.02 },
        { element: 'mgu-k', used: 1, limit: 4, failureProbability: 0.02 },
        { element: 'ers-battery', used: 1, limit: 3, failureProbability: 0.01 },
        { element: 'gearbox', used: 2, limit: 4, failureProbability: 0.02 },
      ],
      pendingComponentSwaps: [{ driverId: 'norris', element: 'ice', electedRound: 5 }],
    })
    // ICE was 4/4; pre-increment used == limit → getGridPenalty returns 10.
    // Then increment to 5/4. Penalty = 10.
    const drivers = [makeDriver('norris', 'mclaren')]
    const result = applyPendingSwaps(team, drivers, 5)
    expect(result.gridPenaltyByDriver['norris']).toBe(10)
    expect(result.team.penaltiesTaken).toBe(1)
  })

  it('escalates penalty for multiple consecutive over-limit swaps on same element', () => {
    const team = makeTeam({
      components: [
        { element: 'ice', used: 5, limit: 4, failureProbability: 0.02 }, // already 1 over
        { element: 'turbo', used: 1, limit: 4, failureProbability: 0.02 },
        { element: 'mgu-k', used: 1, limit: 4, failureProbability: 0.02 },
        { element: 'ers-battery', used: 1, limit: 3, failureProbability: 0.01 },
        { element: 'gearbox', used: 2, limit: 4, failureProbability: 0.02 },
      ],
      pendingComponentSwaps: [{ driverId: 'norris', element: 'ice', electedRound: 5 }],
    })
    // ICE was 5/4 (1 over); pre-increment used = 5, limit = 4 → getGridPenalty
    // returns 10 + 1*5 = 15. Then increment to 6/4. Penalty = 15.
    const drivers = [makeDriver('norris', 'mclaren')]
    const result = applyPendingSwaps(team, drivers, 5)
    expect(result.gridPenaltyByDriver['norris']).toBe(15)
    expect(result.team.penaltiesTaken).toBe(1)
  })

  it('aggregates penalty across multiple elements per driver', () => {
    const team = makeTeam({
      components: [
        { element: 'ice', used: 4, limit: 4, failureProbability: 0.02 },
        { element: 'turbo', used: 4, limit: 4, failureProbability: 0.02 },
        { element: 'mgu-k', used: 1, limit: 4, failureProbability: 0.02 },
        { element: 'ers-battery', used: 1, limit: 3, failureProbability: 0.01 },
        { element: 'gearbox', used: 2, limit: 4, failureProbability: 0.02 },
      ],
      pendingComponentSwaps: [
        { driverId: 'norris', element: 'ice', electedRound: 5 },
        { driverId: 'norris', element: 'turbo', electedRound: 5 },
      ],
    })
    const drivers = [makeDriver('norris', 'mclaren')]
    const result = applyPendingSwaps(team, drivers, 5)
    expect(result.gridPenaltyByDriver['norris']).toBe(20) // 10 + 10
    expect(result.team.penaltiesTaken).toBe(2) // two penalty-incurring swaps
  })

  it('routes penalty to the named driver only (not the team)', () => {
    const team = makeTeam({
      components: [
        { element: 'ice', used: 4, limit: 4, failureProbability: 0.02 },
        { element: 'turbo', used: 1, limit: 4, failureProbability: 0.02 },
        { element: 'mgu-k', used: 1, limit: 4, failureProbability: 0.02 },
        { element: 'ers-battery', used: 1, limit: 3, failureProbability: 0.01 },
        { element: 'gearbox', used: 2, limit: 4, failureProbability: 0.02 },
      ],
      pendingComponentSwaps: [{ driverId: 'norris', element: 'ice', electedRound: 5 }],
    })
    const drivers = [makeDriver('norris', 'mclaren'), makeDriver('piastri', 'mclaren')]
    const result = applyPendingSwaps(team, drivers, 5)
    expect(result.gridPenaltyByDriver['norris']).toBe(10)
    expect(result.gridPenaltyByDriver['piastri']).toBeUndefined()
  })
})

describe('tickComponentWear', () => {
  it('increments every element by exactly 1', () => {
    const team = makeTeam()
    const next = tickComponentWear(team)
    expect(next.components.find((c) => c.element === 'ice')!.used).toBe(3)
    expect(next.components.find((c) => c.element === 'turbo')!.used).toBe(2)
    expect(next.components.find((c) => c.element === 'mgu-k')!.used).toBe(2)
    expect(next.components.find((c) => c.element === 'ers-battery')!.used).toBe(2)
    expect(next.components.find((c) => c.element === 'gearbox')!.used).toBe(3)
  })

  it('preserves all other team fields verbatim', () => {
    const team = makeTeam()
    const next = tickComponentWear(team)
    expect(next.id).toBe(team.id)
    expect(next.car).toEqual(team.car)
    expect(next.constructorPoints).toBe(team.constructorPoints)
    expect(next.fastestLapHistory).toBe(team.fastestLapHistory)
  })
})

describe('projectedGridLossIfElectedNow', () => {
  it('returns 0 when no swap is queued for the driver', () => {
    const team = makeTeam()
    expect(projectedGridLossIfElectedNow(team, 'norris')).toBe(0)
  })

  it('returns the penalty that would apply if the driver elected the next over-limit element', () => {
    const team = makeTeam({
      components: [
        { element: 'ice', used: 4, limit: 4, failureProbability: 0.02 },
        { element: 'turbo', used: 1, limit: 4, failureProbability: 0.02 },
        { element: 'mgu-k', used: 1, limit: 4, failureProbability: 0.02 },
        { element: 'ers-battery', used: 1, limit: 3, failureProbability: 0.01 },
        { element: 'gearbox', used: 2, limit: 4, failureProbability: 0.02 },
      ],
      pendingComponentSwaps: [{ driverId: 'norris', element: 'ice', electedRound: 5 }],
    })
    expect(projectedGridLossIfElectedNow(team, 'norris')).toBe(10)
  })

  it('aggregates across multiple queued swaps for the same driver', () => {
    const team = makeTeam({
      components: [
        { element: 'ice', used: 4, limit: 4, failureProbability: 0.02 },
        { element: 'turbo', used: 4, limit: 4, failureProbability: 0.02 },
        { element: 'mgu-k', used: 1, limit: 4, failureProbability: 0.02 },
        { element: 'ers-battery', used: 1, limit: 3, failureProbability: 0.01 },
        { element: 'gearbox', used: 2, limit: 4, failureProbability: 0.02 },
      ],
      pendingComponentSwaps: [
        { driverId: 'norris', element: 'ice', electedRound: 5 },
        { driverId: 'norris', element: 'turbo', electedRound: 5 },
      ],
    })
    expect(projectedGridLossIfElectedNow(team, 'norris')).toBe(20)
  })
})

describe('componentSwapRows', () => {
  const playerDrivers = [
    { id: 'norris', shortName: 'NOR' },
    { id: 'piastri', shortName: 'PIA' },
  ]

  it('returns one row per (driver × element) where used + 1 >= limit', () => {
    const team = makeTeam({
      components: [
        { element: 'ice', used: 3, limit: 4, failureProbability: 0.02 }, // 3+1=4 >= 4 → row, warning
        { element: 'turbo', used: 1, limit: 4, failureProbability: 0.02 }, // 1+1=2 < 4 → no row
        { element: 'mgu-k', used: 4, limit: 4, failureProbability: 0.02 }, // 4+1=5 > 4 → row, danger
        { element: 'ers-battery', used: 1, limit: 3, failureProbability: 0.01 },
        { element: 'gearbox', used: 2, limit: 4, failureProbability: 0.02 },
      ],
    })
    const rows = componentSwapRows(team, playerDrivers)
    // 2 elements at risk × 2 drivers = 4 rows
    expect(rows).toHaveLength(4)
    const iceRows = rows.filter((r) => r.element === 'ice')
    expect(iceRows).toHaveLength(2)
    expect(iceRows[0].band).toBe('warning') // last free intro
    const mgukRows = rows.filter((r) => r.element === 'mgu-k')
    expect(mgukRows[0].band).toBe('danger') // would incur penalty
  })

  it('marks rows ELECTED when a swap is already queued for that driver+element', () => {
    const team = makeTeam({
      components: [
        { element: 'ice', used: 4, limit: 4, failureProbability: 0.02 },
        { element: 'turbo', used: 1, limit: 4, failureProbability: 0.02 },
        { element: 'mgu-k', used: 1, limit: 4, failureProbability: 0.02 },
        { element: 'ers-battery', used: 1, limit: 3, failureProbability: 0.01 },
        { element: 'gearbox', used: 2, limit: 4, failureProbability: 0.02 },
      ],
      pendingComponentSwaps: [{ driverId: 'norris', element: 'ice', electedRound: 5 }],
    })
    const rows = componentSwapRows(team, playerDrivers)
    const norrisIce = rows.find((r) => r.driverId === 'norris' && r.element === 'ice')!
    const piastriIce = rows.find((r) => r.driverId === 'piastri' && r.element === 'ice')!
    expect(norrisIce.elected).toBe(true)
    expect(piastriIce.elected).toBe(false)
  })

  it('returns empty array when no element is at or near limit', () => {
    const team = makeTeam() // default fixture has plenty of headroom
    expect(componentSwapRows(team, playerDrivers)).toEqual([])
  })
})
