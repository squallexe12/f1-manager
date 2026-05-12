import { describe, it, expect } from 'vitest'
import { activeAeroMaturity, hybridEfficiencyScore, grid2026AdoptionRank } from '@/engine/engineering/regulation-metrics'
import type { Team, CarPerformance, RndUpgrade } from '@/types/team'

function car(values: Partial<CarPerformance> = {}): CarPerformance {
  return {
    downforce: 60,
    straightSpeed: 60,
    reliability: 60,
    tireManagement: 60,
    braking: 60,
    cornering: 60,
    ...values,
  }
}

function upgrade(
  id: string,
  branch: RndUpgrade['branch'],
  status: RndUpgrade['status'],
  progress: number,
): RndUpgrade {
  return {
    id,
    branch,
    name: id,
    description: '',
    progress,
    status,
    cost: 0,
    developmentRaces: 4,
    performanceDelta: {},
    prerequisiteIds: [],
    wtHoursPerCycle: 0,
    cfdRunsPerCycle: 0,
  }
}

function team(id: string, upgrades: RndUpgrade[] = []): Team {
  return {
    id,
    name: id,
    shortName: id.toUpperCase(),
    headquarters: 'X',
    color: '#000',
    powerUnitSupplier: 'x',
    driverIds: ['d1', 'd2'],
    reserveDriverId: null,
    staff: [],
    car: car(),
    rndUpgrades: upgrades,
    components: [],
    windTunnelHoursUsed: 0,
    windTunnelHoursLimit: 240,
    cfdRunsUsed: 0,
    cfdRunsLimit: 3200,
    morale: 70,
    aiPersonality: null,
    constructorPoints: 0,
    constructorPosition: 1,
    previousConstructorPosition: 1,
    previousMorale: 70,
    seasonForm: [],
    lastProcessedRound: 0,
    ovrHistory: [],
    lastUpgradeRound: 0,
    fastestLapHistory: [],
    failureEvents: [],
    penaltiesTaken: 0,
    pendingComponentSwaps: [],
    aeroBookings: [],
    upgradeOutcomes: [],
    pitCrewChief: null,
    pitCrewMembers: [],
  }
}

describe('activeAeroMaturity', () => {
  it('returns 0 when the team has no aero-branch upgrades', () => {
    const t = team('t', [
      upgrade('c1', 'chassis', 'complete', 100),
      upgrade('pu1', 'power-unit', 'complete', 100),
    ])
    expect(activeAeroMaturity(t)).toBe(0)
  })

  it('returns 0 when rndUpgrades is empty', () => {
    expect(activeAeroMaturity(team('t', []))).toBe(0)
  })

  it('returns 100 when every aero upgrade is complete', () => {
    const t = team('t', [
      upgrade('a1', 'active-aero', 'complete', 100),
      upgrade('a2', 'active-aero', 'complete', 100),
      upgrade('pu', 'power-unit', 'locked', 0),
    ])
    expect(activeAeroMaturity(t)).toBe(100)
  })

  it('mixes complete and in-progress: 1 complete + 1 at 50% = 75', () => {
    const t = team('t', [
      upgrade('a1', 'active-aero', 'complete', 100),
      upgrade('a2', 'active-aero', 'in-progress', 50),
    ])
    expect(activeAeroMaturity(t)).toBe(75)
  })

  it('rounds to the nearest integer (1/3 complete → 33)', () => {
    const t = team('t', [
      upgrade('a1', 'active-aero', 'complete', 100),
      upgrade('a2', 'active-aero', 'locked', 0),
      upgrade('a3', 'active-aero', 'available', 0),
    ])
    expect(activeAeroMaturity(t)).toBe(33)
  })
})

describe('hybridEfficiencyScore', () => {
  it('returns 0 on a virgin team (no PU upgrades, zero reliability proxy denominator-safe)', () => {
    const t = team('t', [])
    // Reliability proxy: 1 - 0/22 = 1; powerAxis = 60/100 = 0.6.
    // 0.50 * 0 + 0.30 * 1 + 0.20 * 0.6 = 0.42 → 42.
    expect(hybridEfficiencyScore(t)).toBe(42)
  })

  it('clamps penaltiesTaken so the reliability proxy never goes negative', () => {
    const t = team('t', [])
    t.penaltiesTaken = 999
    // proxy clamps to 0 → 0.50*0 + 0.30*0 + 0.20*0.6 = 0.12 → 12.
    expect(hybridEfficiencyScore(t)).toBe(12)
  })

  it('reaches 100 only when all three inputs are maxed', () => {
    const t = team('t', [
      upgrade('p1', 'power-unit', 'complete', 100),
      upgrade('p2', 'power-unit', 'complete', 100),
    ])
    t.car.straightSpeed = 100
    expect(hybridEfficiencyScore(t)).toBe(100)
  })

  it('treats NaN straightSpeed as 0 (defensive)', () => {
    const t = team('t', [])
    ;(t.car as { straightSpeed: number }).straightSpeed = Number.NaN
    // 0.50*0 + 0.30*1 + 0.20*0 = 0.30 → 30.
    expect(hybridEfficiencyScore(t)).toBe(30)
  })
})

describe('grid2026AdoptionRank', () => {
  it('returns { rank: 1, of: 1 } in a single-team grid', () => {
    expect(grid2026AdoptionRank([team('solo')], 'solo')).toEqual({ rank: 1, of: 1 })
  })

  it('returns the sentinel { rank: 0, of: n } when the player team is absent', () => {
    expect(grid2026AdoptionRank([team('a'), team('b')], 'ghost')).toEqual({
      rank: 0,
      of: 2,
    })
  })

  it('ranks by combined score descending', () => {
    const top = team('top', [
      upgrade('a1', 'active-aero', 'complete', 100),
      upgrade('p1', 'power-unit', 'complete', 100),
    ])
    top.car.straightSpeed = 100
    const mid = team('mid', [upgrade('a1', 'active-aero', 'complete', 100)])
    const low = team('low', [])
    const result = grid2026AdoptionRank([low, mid, top], 'top')
    expect(result).toEqual({ rank: 1, of: 3 })
  })

  it('places the lowest scorer last', () => {
    const top = team('top', [
      upgrade('a1', 'active-aero', 'complete', 100),
      upgrade('p1', 'power-unit', 'complete', 100),
    ])
    top.car.straightSpeed = 100
    const low = team('low', [])
    expect(grid2026AdoptionRank([top, low], 'low')).toEqual({ rank: 2, of: 2 })
  })

  it('breaks ties by team.id ASC (deterministic)', () => {
    // Two virgin teams have identical combined scores.
    const a = team('aaa')
    const b = team('bbb')
    expect(grid2026AdoptionRank([b, a], 'aaa')).toEqual({ rank: 1, of: 2 })
    expect(grid2026AdoptionRank([b, a], 'bbb')).toEqual({ rank: 2, of: 2 })
  })
})
