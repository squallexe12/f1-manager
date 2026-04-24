import { describe, it, expect } from 'vitest'
import {
  peerAveragedAxes,
  peerRank,
  deltaVsLeaderSeconds,
  fleetHealth,
  projectNextChange,
  projectedGridLoss,
  atrCoefficientForPosition,
  correlationDelta,
  nextDeliveryRound,
  windowResetsIn,
  reliabilityMtbf,
  deterministicAeroHistory,
} from '@/engine/engineering/factory-insights'
import type { Team, CarPerformance, ComponentAllocation, RndUpgrade } from '@/types/team'

function car(values: Partial<CarPerformance> = {}): CarPerformance {
  return {
    downforce: 80,
    straightSpeed: 80,
    reliability: 80,
    tireManagement: 80,
    braking: 80,
    cornering: 80,
    ...values,
  }
}

function team(id: string, pos: number, perf: Partial<CarPerformance> = {}): Team {
  return {
    id,
    name: id,
    shortName: id.toUpperCase(),
    headquarters: 'Testville',
    color: '#000',
    powerUnitSupplier: 'x',
    driverIds: ['d1', 'd2'],
    reserveDriverId: null,
    staff: [],
    car: car(perf),
    rndUpgrades: [],
    components: [],
    windTunnelHoursUsed: 0,
    windTunnelHoursLimit: 240,
    cfdRunsUsed: 0,
    cfdRunsLimit: 3200,
    morale: 70,
    aiPersonality: null,
    constructorPoints: 0,
    constructorPosition: pos,
    previousConstructorPosition: pos,
    previousMorale: 70,
    seasonForm: [],
    lastProcessedRound: 0,
    ovrHistory: [],
    lastUpgradeRound: 0,
  }
}

function component(element: ComponentAllocation['element'], used: number, limit: number): ComponentAllocation {
  return { element, used, limit, failureProbability: 0.02 }
}

function upgrade(
  id: string,
  status: RndUpgrade['status'],
  progress: number,
  races: number,
  branch: RndUpgrade['branch'] = 'chassis',
): RndUpgrade {
  return {
    id,
    branch,
    name: id,
    description: '',
    progress,
    status,
    cost: 1_000_000,
    developmentRaces: races,
    performanceDelta: {},
    prerequisiteIds: [],
  }
}

describe('peerAveragedAxes', () => {
  it('averages non-player teams axis-by-axis', () => {
    const teams = [
      team('player', 3, { downforce: 90, straightSpeed: 90 }),
      team('a', 1, { downforce: 80, straightSpeed: 70 }),
      team('b', 2, { downforce: 60, straightSpeed: 50 }),
    ]
    const axes = peerAveragedAxes(teams, 'player')
    // AXES order: downforce, straightSpeed, braking, cornering, reliability, tireManagement
    expect(axes[0]).toBe(70) // (80+60)/2
    expect(axes[1]).toBe(60) // (70+50)/2
  })

  it('returns 70 baseline when there are no peers', () => {
    const teams = [team('player', 1)]
    const axes = peerAveragedAxes(teams, 'player')
    expect(axes).toEqual([70, 70, 70, 70, 70, 70])
  })
})

describe('peerRank', () => {
  it('returns the player team constructor position, clamped to [1,11]', () => {
    const teams = [team('p', 4)]
    expect(peerRank(teams, 'p')).toBe(4)
  })
  it('falls back to 11 when team missing', () => {
    expect(peerRank([], 'ghost')).toBe(11)
  })
  it('clamps invalid positions to 1', () => {
    const teams = [team('p', 0)]
    expect(peerRank(teams, 'p')).toBe(1)
  })
})

describe('deltaVsLeaderSeconds', () => {
  it('returns 0 when player is the leader', () => {
    const teams = [team('p', 1, { downforce: 90 }), team('a', 2, { downforce: 60 })]
    expect(deltaVsLeaderSeconds(teams, 'p')).toBe(0)
  })
  it('returns a negative seconds gap when player trails', () => {
    const teams = [team('p', 3, { downforce: 60 }), team('a', 1, { downforce: 90 })]
    const d = deltaVsLeaderSeconds(teams, 'p')
    expect(d).toBeLessThan(0)
  })
  it('is monotonic in OVR gap', () => {
    const tight = deltaVsLeaderSeconds(
      [team('p', 2, { downforce: 85 }), team('a', 1, { downforce: 90 })],
      'p',
    )
    const wide = deltaVsLeaderSeconds(
      [team('p', 2, { downforce: 60 }), team('a', 1, { downforce: 90 })],
      'p',
    )
    expect(wide).toBeLessThan(tight)
  })
})

describe('fleetHealth', () => {
  it('returns NOMINAL when every component has margin', () => {
    expect(fleetHealth([component('ice', 1, 4), component('turbo', 0, 4)])).toBe('NOMINAL')
  })
  it('returns AT RISK when any component is one away from the limit', () => {
    expect(fleetHealth([component('ice', 3, 4)])).toBe('AT RISK')
  })
  it('returns CRITICAL when any component is at or over the limit', () => {
    expect(fleetHealth([component('ice', 4, 4)])).toBe('CRITICAL')
  })
})

describe('projectNextChange', () => {
  it('picks the element with the highest used/limit ratio', () => {
    const comps = [
      component('ice', 2, 4),
      component('turbo', 3, 4),
      component('gearbox', 1, 4),
    ]
    const next = projectNextChange(comps, 7, 22)
    expect(next).not.toBeNull()
    expect(next!.element).toBe('turbo')
    expect(next!.round).toBeGreaterThanOrEqual(7)
  })
  it('returns null when no component is close to the limit', () => {
    const comps = [component('ice', 0, 4)]
    expect(projectNextChange(comps, 7, 22)).toBeNull()
  })
})

describe('projectedGridLoss', () => {
  it('sums grid penalties only for over-limit components', () => {
    const comps = [
      component('ice', 3, 4),   // 0
      component('turbo', 4, 4), // 10
      component('gearbox', 5, 4), // 15
    ]
    expect(projectedGridLoss(comps)).toBe(25)
  })
})

describe('atrCoefficientForPosition', () => {
  it('champion gets the lowest coefficient', () => {
    expect(atrCoefficientForPosition(1)).toBeLessThan(atrCoefficientForPosition(11))
  })
  it('values are within the published F1 2026 band (0.70–1.00)', () => {
    for (let pos = 1; pos <= 11; pos++) {
      const v = atrCoefficientForPosition(pos)
      expect(v).toBeGreaterThanOrEqual(0.7)
      expect(v).toBeLessThanOrEqual(1.0)
    }
  })
})

describe('correlationDelta', () => {
  it('is deterministic for a given team id and round', () => {
    expect(correlationDelta('mclaren', 7)).toBe(correlationDelta('mclaren', 7))
  })
  it('stays within ±5%', () => {
    for (const id of ['mclaren', 'ferrari', 'audi', 'cadillac']) {
      for (let round = 1; round <= 22; round++) {
        const v = correlationDelta(id, round)
        expect(Math.abs(v)).toBeLessThanOrEqual(5)
      }
    }
  })
})

describe('nextDeliveryRound', () => {
  it('returns the in-progress upgrade with fewest remaining races', () => {
    const ups = [
      upgrade('a', 'in-progress', 20, 4), // 3.2 → 4 races remaining
      upgrade('b', 'in-progress', 80, 5), // 1 race remaining
    ]
    const next = nextDeliveryRound(ups, 7)
    expect(next).not.toBeNull()
    expect(next!.upgradeId).toBe('b')
    expect(next!.round).toBe(8)
  })
  it('returns null if no active upgrades', () => {
    expect(nextDeliveryRound([upgrade('a', 'available', 0, 3)], 5)).toBeNull()
  })
})

describe('windowResetsIn', () => {
  it('returns days until the next ATR window reset (14-day cycle)', () => {
    // currentRound 7 with 22 races — deterministic modulo derivation
    const days = windowResetsIn(7)
    expect(days).toBeGreaterThanOrEqual(0)
    expect(days).toBeLessThanOrEqual(14)
  })
})

describe('reliabilityMtbf', () => {
  it('returns a positive number of laps', () => {
    const mtbf = reliabilityMtbf(car({ reliability: 80 }), [component('ice', 1, 4)])
    expect(mtbf).toBeGreaterThan(0)
  })
  it('rises with car reliability', () => {
    const low = reliabilityMtbf(car({ reliability: 40 }), [component('ice', 1, 4)])
    const high = reliabilityMtbf(car({ reliability: 95 }), [component('ice', 1, 4)])
    expect(high).toBeGreaterThan(low)
  })
  it('falls as components approach their limits', () => {
    const fresh = reliabilityMtbf(car({ reliability: 80 }), [component('ice', 0, 4)])
    const worn = reliabilityMtbf(car({ reliability: 80 }), [component('ice', 3, 4)])
    expect(worn).toBeLessThan(fresh)
  })
})

describe('deterministicAeroHistory', () => {
  it('returns exactly 14 entries', () => {
    const hist = deterministicAeroHistory('mclaren', 7, 0.5)
    expect(hist).toHaveLength(14)
  })
  it('is deterministic for a given (teamId, round, usageRatio)', () => {
    const a = deterministicAeroHistory('mclaren', 7, 0.5)
    const b = deterministicAeroHistory('mclaren', 7, 0.5)
    expect(a).toEqual(b)
  })
  it('differs across rounds', () => {
    const r7 = deterministicAeroHistory('mclaren', 7, 0.5)
    const r8 = deterministicAeroHistory('mclaren', 8, 0.5)
    expect(r7).not.toEqual(r8)
  })
  it('values are normalised between 0 and 1', () => {
    for (const ratio of [0.1, 0.5, 0.9]) {
      for (const v of deterministicAeroHistory('mclaren', 7, ratio)) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
    }
  })
  it('scales with usage ratio on average', () => {
    const low = deterministicAeroHistory('mclaren', 7, 0.1)
    const high = deterministicAeroHistory('mclaren', 7, 0.9)
    const lowAvg = low.reduce((a, b) => a + b, 0) / low.length
    const highAvg = high.reduce((a, b) => a + b, 0) / high.length
    expect(highAvg).toBeGreaterThan(lowAvg)
  })
})
