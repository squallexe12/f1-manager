import { describe, it, expect } from 'vitest'
import type { Team, FastestLapEntry, ComponentAllocation, FailureEvent } from '@/types/team'
import {
  deltaVsLeaderFromHistory,
  mtbfFromFailureLog,
} from '@/engine/engineering/car-performance-insights'

function makeComponents(rows: Partial<ComponentAllocation>[]): ComponentAllocation[] {
  return rows.map((r) => ({
    element: r.element ?? 'ice',
    used: r.used ?? 0,
    limit: r.limit ?? 4,
    failureProbability: r.failureProbability ?? 0.03,
  }))
}

/**
 * Minimal Team factory for insights tests. Only fields the insights
 * helpers actually read need realistic values; everything else is filled
 * with zero-/empty defaults.
 */
function makeTeam(
  id: string,
  fastestLapHistory: FastestLapEntry[] = [],
  overrides: Partial<Team> = {},
): Team {
  return {
    id,
    name: id,
    shortName: id.toUpperCase(),
    color: '#000',
    headquarters: 'Test',
    powerUnitSupplier: 'x',
    driverIds: ['', ''],
    reserveDriverId: null,
    staff: [],
    car: {
      downforce: 70, straightSpeed: 70, reliability: 70,
      tireManagement: 70, braking: 70, cornering: 70,
    },
    rndUpgrades: [],
    components: [],
    windTunnelHoursUsed: 0,
    windTunnelHoursLimit: 280,
    cfdRunsUsed: 0,
    cfdRunsLimit: 2400,
    morale: 70,
    aiPersonality: null,
    constructorPoints: 0,
    constructorPosition: 11,
    previousConstructorPosition: 0,
    previousMorale: 70,
    seasonForm: [],
    lastProcessedRound: 0,
    ovrHistory: [],
    lastUpgradeRound: 0,
    fastestLapHistory,
    failureEvents: [],
    penaltiesTaken: 0,
    pendingComponentSwaps: [],
    aeroBookings: [],
    upgradeOutcomes: [],
    pitCrewChief: null,
    pitCrewMembers: [],
    ...overrides,
  }
}

describe('deltaVsLeaderFromHistory', () => {
  it('returns 0 when player IS the championship leader', () => {
    const player = makeTeam('mclaren', [
      { round: 1, lapMs: 78_000 },
      { round: 2, lapMs: 78_100 },
      { round: 3, lapMs: 78_050 },
    ], { constructorPosition: 1 })
    expect(deltaVsLeaderFromHistory([player], 'mclaren')).toBe(0)
  })

  it('returns 0 when championship leader cannot be located', () => {
    // No team holds constructorPosition === 1.
    const player = makeTeam('mclaren', [
      { round: 1, lapMs: 78_000 },
    ], { constructorPosition: 11 })
    expect(deltaVsLeaderFromHistory([player], 'mclaren')).toBe(0)
  })

  it('falls back to OVR-heuristic when player has fewer than 3 entries', () => {
    const player = makeTeam('mclaren', [
      { round: 1, lapMs: 79_000 },
    ], { constructorPosition: 4, car: {
      downforce: 70, straightSpeed: 70, reliability: 70,
      tireManagement: 70, braking: 70, cornering: 70,
    } })
    const leader = makeTeam('red-bull', [
      { round: 1, lapMs: 78_000 },
      { round: 2, lapMs: 78_000 },
      { round: 3, lapMs: 78_000 },
    ], { constructorPosition: 1, car: {
      downforce: 90, straightSpeed: 90, reliability: 90,
      tireManagement: 90, braking: 90, cornering: 90,
    } })
    const result = deltaVsLeaderFromHistory([player, leader], 'mclaren')
    // Fallback path: player slower than leader → negative seconds.
    expect(result).toBeLessThan(0)
    expect(Number.isFinite(result)).toBe(true)
  })

  it('averages last 3 fastest-lap deltas vs leader', () => {
    const player = makeTeam('mclaren', [
      { round: 1, lapMs: 79_000 },
      { round: 2, lapMs: 78_500 },
      { round: 3, lapMs: 78_300 },
    ], { constructorPosition: 4 })
    const leader = makeTeam('red-bull', [
      { round: 1, lapMs: 78_000 },
      { round: 2, lapMs: 78_000 },
      { round: 3, lapMs: 78_000 },
    ], { constructorPosition: 1 })
    // deltas (player - leader): +1000ms, +500ms, +300ms → avg = +600ms = 0.6s slower.
    expect(deltaVsLeaderFromHistory([player, leader], 'mclaren')).toBeCloseTo(0.6, 2)
  })

  it('falls back to OVR-heuristic when fewer than 3 overlapping rounds with leader', () => {
    const player = makeTeam('mclaren', [
      { round: 1, lapMs: 78_500 },
      { round: 5, lapMs: 78_500 },
      { round: 6, lapMs: 78_500 },
    ], { constructorPosition: 4 })
    const leader = makeTeam('red-bull', [
      { round: 2, lapMs: 78_000 },
      { round: 3, lapMs: 78_000 },
      { round: 4, lapMs: 78_000 },
    ], { constructorPosition: 1 })
    // No overlapping rounds → OVR fallback. Both have identical car so result = 0.
    const result = deltaVsLeaderFromHistory([player, leader], 'mclaren')
    expect(result).toBeLessThanOrEqual(0)
  })

  it('returns 0 when player team is missing from teams list', () => {
    expect(deltaVsLeaderFromHistory([], 'mclaren')).toBe(0)
  })
})

describe('mtbfFromFailureLog', () => {
  it('returns heuristic when fewer than 2 failure events recorded', () => {
    const team = makeTeam('mclaren', [], {
      car: { downforce: 80, straightSpeed: 80, reliability: 80, tireManagement: 80, braking: 80, cornering: 80 },
      components: makeComponents([
        { element: 'ice', used: 1, limit: 4 },
        { element: 'turbo', used: 1, limit: 4 },
      ]),
      failureEvents: [],
    })
    const result = mtbfFromFailureLog(team)
    expect(result).toBeGreaterThan(0)
    expect(Number.isFinite(result)).toBe(true)
  })

  it('uses average laps-between-failures when 2+ events recorded', () => {
    const events: FailureEvent[] = [
      { round: 1, lap: 20, element: 'ice', driverId: 'norris' },
      { round: 1, lap: 35, element: 'turbo', driverId: 'piastri' },
    ]
    const team = makeTeam('mclaren', [], { failureEvents: events })
    const result = mtbfFromFailureLog(team)
    // Same-round gap: 35 - 20 = 15 laps. With one gap, MTBF ~= 15.
    expect(result).toBeGreaterThan(0)
    expect(result).toBeLessThan(70) // realistic race-lap range
  })

  it('heuristic uses worst per-element wear (a single dead element drags MTBF down)', () => {
    const teamFresh = makeTeam('mclaren', [], {
      car: { downforce: 80, straightSpeed: 80, reliability: 80, tireManagement: 80, braking: 80, cornering: 80 },
      components: makeComponents([
        { element: 'ice', used: 1, limit: 4 },
        { element: 'turbo', used: 1, limit: 4 },
      ]),
    })
    const teamWornIce = makeTeam('mclaren', [], {
      car: { downforce: 80, straightSpeed: 80, reliability: 80, tireManagement: 80, braking: 80, cornering: 80 },
      components: makeComponents([
        { element: 'ice', used: 4, limit: 4 }, // at limit — heavily worn
        { element: 'turbo', used: 1, limit: 4 },
      ]),
    })
    expect(mtbfFromFailureLog(teamWornIce)).toBeLessThan(mtbfFromFailureLog(teamFresh))
  })

  it('returns sensible value with no components defined', () => {
    const team = makeTeam('mclaren', [], {
      car: { downforce: 80, straightSpeed: 80, reliability: 80, tireManagement: 80, braking: 80, cornering: 80 },
      components: [],
    })
    const result = mtbfFromFailureLog(team)
    expect(result).toBeGreaterThan(0)
  })
})
