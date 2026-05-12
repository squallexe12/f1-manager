import { describe, it, expect } from 'vitest'
import { activeAeroMaturity } from '@/engine/engineering/regulation-metrics'
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
