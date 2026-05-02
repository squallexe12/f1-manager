import { describe, it, expect } from 'vitest'
import { processSeasonEnd } from '@/engine/core/season-end-processor'
import type { Team } from '@/types/team'
import type { Driver } from '@/types/driver'
import type { FinanceState } from '@/types/finance'
import type { PitCrewChief, PitCrewMember, PoachingAttempt } from '@/types/staff'

function makeChief(id: string): PitCrewChief {
  return {
    id, firstName: 'Test', lastName: 'Chief', nationality: 'Italian', age: 45,
    releaseSupervision: 80, speedDisciplineCoaching: 80, serviceCoordination: 80,
    contract: { salary: 2_000_000, termEndSeason: 3, performanceBonuses: [], releaseClause: null },
  }
}

function makeMember(id: string, role: PitCrewMember['role']): PitCrewMember {
  return {
    id, firstName: 'Test', lastName: 'Member', nationality: 'British', age: 35, role, rating: 75,
    contract: { salary: 800_000, termEndSeason: 3, performanceBonuses: [], releaseClause: null },
  }
}

function makeTeam(id: string, overrides: Partial<Team> = {}): Team {
  return {
    id, name: id, shortName: id.toUpperCase(), color: '#000', headquarters: 'X',
    powerUnitSupplier: 'x', driverIds: ['a', 'b'], reserveDriverId: null,
    staff: [], car: { downforce: 80, straightSpeed: 80, reliability: 80, tireManagement: 80, braking: 80, cornering: 80 },
    rndUpgrades: [], components: [],
    windTunnelHoursUsed: 0, windTunnelHoursLimit: 200,
    cfdRunsUsed: 0, cfdRunsLimit: 3000,
    morale: 70, aiPersonality: null,
    constructorPoints: 0, constructorPosition: 5, previousConstructorPosition: 5,
    previousMorale: 70, seasonForm: [], lastProcessedRound: 0,
    ovrHistory: [], lastUpgradeRound: 0,
    fastestLapHistory: [], failureEvents: [],
    penaltiesTaken: 0, pendingComponentSwaps: [],
    aeroBookings: [], upgradeOutcomes: [],
    pitCrewChief: null, pitCrewMembers: [],
    ...overrides,
  }
}

function makeFinance(): FinanceState {
  return {
    budget: { cap: 215_000_000, totalSpent: 0, categories: [], projectedEndOfSeason: 200_000_000, penaltyRisk: false },
    sponsors: [], prestige: 'B', prestigeScore: 65, prizeMoneyEstimate: 0, marketingBudget: 0,
  }
}

function makeAttempt(targetStaffId: string, status: PoachingAttempt['status']): PoachingAttempt {
  return {
    id: `attempt-${targetStaffId}`,
    rivalTeamId: 'rival',
    targetStaffId,
    offeredRole: 'chief',
    offeredSalary: 3_000_000,
    raisedOnRound: 5,
    expiresOnRound: 8,
    status,
  }
}

describe('processSeasonEnd — declined-poaching staff departure', () => {
  it('removes the targeted chief when the player declined a poaching offer', () => {
    const chief = makeChief('chief-1')
    const playerTeam = makeTeam('player', { pitCrewChief: chief })
    const result = processSeasonEnd(
      [playerTeam],
      [],
      { player: makeFinance() },
      1,
      [makeAttempt(chief.id, 'declined')],
      'player',
    )
    const playerAfter = result.teams.find((t) => t.id === 'player')!
    expect(playerAfter.pitCrewChief).toBeNull()
  })

  it('removes the targeted member but keeps other members on the roster', () => {
    const lollipop = makeMember('m-l', 'lollipop')
    const frontJack = makeMember('m-fj', 'front-jack')
    const playerTeam = makeTeam('player', { pitCrewMembers: [lollipop, frontJack] })
    const result = processSeasonEnd(
      [playerTeam],
      [],
      { player: makeFinance() },
      1,
      [makeAttempt(lollipop.id, 'declined')],
      'player',
    )
    const playerAfter = result.teams.find((t) => t.id === 'player')!
    expect(playerAfter.pitCrewMembers.map((m) => m.id)).toEqual(['m-fj'])
  })

  it('leaves staff in place when the attempt was matched (player kept them)', () => {
    const chief = makeChief('chief-1')
    const playerTeam = makeTeam('player', { pitCrewChief: chief })
    const result = processSeasonEnd(
      [playerTeam],
      [],
      { player: makeFinance() },
      1,
      [makeAttempt(chief.id, 'matched')],
      'player',
    )
    const playerAfter = result.teams.find((t) => t.id === 'player')!
    expect(playerAfter.pitCrewChief?.id).toBe('chief-1')
  })

  it('always returns an empty poachingAttempts array (matched/declined/expired all cleared)', () => {
    const result = processSeasonEnd(
      [makeTeam('player')],
      [],
      { player: makeFinance() },
      1,
      [
        makeAttempt('staff-a', 'declined'),
        makeAttempt('staff-b', 'matched'),
        makeAttempt('staff-c', 'expired'),
        makeAttempt('staff-d', 'open'),
      ],
      'player',
    )
    expect(result.poachingAttempts).toEqual([])
  })

  it('is a no-op when the function is called without poachingAttempts (legacy callers)', () => {
    const chief = makeChief('chief-1')
    const playerTeam = makeTeam('player', { pitCrewChief: chief })
    const result = processSeasonEnd(
      [playerTeam],
      [],
      { player: makeFinance() },
      1,
    )
    const playerAfter = result.teams.find((t) => t.id === 'player')!
    expect(playerAfter.pitCrewChief?.id).toBe('chief-1')
  })

  it('does not affect AI teams (declined poaching only targets the player)', () => {
    const playerTeam = makeTeam('player')
    const aiTeam = makeTeam('ai-1', { pitCrewChief: makeChief('chief-ai') })
    const result = processSeasonEnd(
      [playerTeam, aiTeam],
      [],
      { player: makeFinance(), 'ai-1': makeFinance() },
      1,
      // The declined-target id matches the AI team's chief by id collision.
      // Player team has no chief, so removing ai chief shouldn't happen.
      [{
        ...makeAttempt('chief-ai', 'declined'),
        rivalTeamId: 'rival',
      }],
      'player',
    )
    const aiAfter = result.teams.find((t) => t.id === 'ai-1')!
    expect(aiAfter.pitCrewChief?.id).toBe('chief-ai')
  })
})
