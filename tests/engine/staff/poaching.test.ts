import { describe, it, expect } from 'vitest'
import { evaluatePoachingAttempts } from '@/engine/staff/poaching'
import { createPRNG } from '@/engine/core/prng'
import type { Team } from '@/types/team'
import type { PitCrewChief, PitCrewMember, PoachingAttempt, StaffMarket } from '@/types/staff'
import type { FinanceState } from '@/types/finance'

function makeChief(id: string, ratings = 80): PitCrewChief {
  return {
    id, firstName: 'Test', lastName: 'Chief', nationality: 'Italian', age: 45,
    releaseSupervision: ratings, speedDisciplineCoaching: ratings, serviceCoordination: ratings,
    contract: { salary: 2_000_000, termEndSeason: 3, performanceBonuses: [], releaseClause: null },
  }
}

function makeMember(id: string, role: PitCrewMember['role'], rating = 75): PitCrewMember {
  return {
    id, firstName: 'Test', lastName: 'Member', nationality: 'British', age: 35, role, rating,
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

function makeFinance(budget: number): FinanceState {
  return {
    budget: {
      cap: budget,
      totalSpent: 0,
      categories: [],
      projectedEndOfSeason: budget * 0.8,
      penaltyRisk: false,
    },
    sponsors: [],
    prestige: 'B',
    prestigeScore: 65,
    prizeMoneyEstimate: 0,
    marketingBudget: 0,
    bankedBonuses: 0,
  }
}

function makeMarket(): StaffMarket {
  return { chiefs: [], members: [], lastRefreshedSeason: 1 }
}

describe('evaluatePoachingAttempts', () => {
  it('returns no attempts when player has no staff hired', () => {
    const playerTeam = makeTeam('player') // no chief, no members
    const aiTeam = makeTeam('ai-1', { pitCrewChief: makeChief('cheap-c', 50) })
    const result = evaluatePoachingAttempts({
      playerTeamId: 'player',
      teams: [playerTeam, aiTeam],
      finance: { 'player': makeFinance(200_000_000), 'ai-1': makeFinance(200_000_000) },
      currentRound: 5,
      currentSeason: 1,
      existingAttempts: [],
      market: makeMarket(),
    }, createPRNG(1))
    expect(result.attempts).toEqual([])
  })

  it('returns at most one attempt per evaluation (rate-limit cap)', () => {
    const eliteChief = makeChief('elite-c', 95)
    const playerTeam = makeTeam('player', { pitCrewChief: eliteChief })
    const aiTeams = ['a', 'b', 'c'].map((id) =>
      makeTeam(`ai-${id}`, { pitCrewChief: makeChief(`weak-${id}`, 40) }),
    )
    const finance: Record<string, FinanceState> = {}
    for (const t of [playerTeam, ...aiTeams]) {
      finance[t.id] = makeFinance(200_000_000)
    }
    const result = evaluatePoachingAttempts({
      playerTeamId: 'player',
      teams: [playerTeam, ...aiTeams],
      finance,
      currentRound: 8,
      currentSeason: 1,
      existingAttempts: [],
      market: makeMarket(),
    }, createPRNG(1))
    expect(result.attempts.length).toBeLessThanOrEqual(1)
  })

  it('attempts target the player, not AI teams', () => {
    const playerTeam = makeTeam('player', { pitCrewChief: makeChief('top-c', 95) })
    const aiTeam = makeTeam('ai-1', { pitCrewChief: makeChief('weak-c', 35) })
    const finance: Record<string, FinanceState> = {
      'player': makeFinance(200_000_000),
      'ai-1': makeFinance(200_000_000),
    }
    const result = evaluatePoachingAttempts({
      playerTeamId: 'player',
      teams: [playerTeam, aiTeam],
      finance,
      currentRound: 8,
      currentSeason: 1,
      existingAttempts: [],
      market: makeMarket(),
    }, createPRNG(1))
    for (const a of result.attempts) {
      expect(a.rivalTeamId).not.toBe('player')
    }
  })

  it('is deterministic on (seed, round)', () => {
    const playerTeam = makeTeam('player', {
      pitCrewChief: makeChief('top-c', 92),
      pitCrewMembers: [makeMember('m1', 'lollipop', 88)],
    })
    const aiTeam = makeTeam('ai-1', { pitCrewChief: makeChief('weak-c', 40) })
    const finance: Record<string, FinanceState> = {
      'player': makeFinance(200_000_000),
      'ai-1': makeFinance(200_000_000),
    }
    const args = {
      playerTeamId: 'player',
      teams: [playerTeam, aiTeam],
      finance,
      currentRound: 8,
      currentSeason: 1,
      existingAttempts: [] as PoachingAttempt[],
      market: makeMarket(),
    }
    const a = evaluatePoachingAttempts(args, createPRNG(42))
    const b = evaluatePoachingAttempts(args, createPRNG(42))
    expect(a.attempts).toEqual(b.attempts)
  })

  it('open attempts on the same target are NOT duplicated', () => {
    const eliteChief = makeChief('top-c', 95)
    const playerTeam = makeTeam('player', { pitCrewChief: eliteChief })
    const aiTeam = makeTeam('ai-1', { pitCrewChief: makeChief('weak-c', 40) })
    const finance: Record<string, FinanceState> = {
      'player': makeFinance(200_000_000),
      'ai-1': makeFinance(200_000_000),
    }
    const existingOpen: PoachingAttempt = {
      id: 'p-existing',
      rivalTeamId: 'ai-1',
      targetStaffId: eliteChief.id,
      offeredRole: 'chief',
      offeredSalary: 3_000_000,
      raisedOnRound: 7,
      expiresOnRound: 10,
      status: 'open',
    }
    const result = evaluatePoachingAttempts({
      playerTeamId: 'player',
      teams: [playerTeam, aiTeam],
      finance,
      currentRound: 8,
      currentSeason: 1,
      existingAttempts: [existingOpen],
      market: makeMarket(),
    }, createPRNG(1))
    // No new attempt for the same target.
    for (const a of result.attempts) {
      expect(a.targetStaffId).not.toBe(eliteChief.id)
    }
  })
})
