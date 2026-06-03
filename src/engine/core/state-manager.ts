import type { GameState, Phase, ScenarioType } from '@/types/game'
import type { Team } from '@/types/team'
import type { Driver } from '@/types/driver'
import type { Race } from '@/types/race'
import type { FinanceState, PrestigeRating } from '@/types/finance'
import type { NarrativeEvent, StoryArc } from '@/types/narrative'
import type { Recommendation, StagedStrategies } from '@/types/delegation'
import { TEAMS, type TeamData } from '@/data/teams'
import { DRIVERS } from '@/data/drivers'
import { CALENDAR } from '@/data/calendar'
import { SCENARIOS } from '@/data/scenarios'
import { RND_TREE } from '@/data/rnd-tree'
import { SPONSORS } from '@/data/sponsors'
import { getAvailableSponsors, signSponsor } from '@/engine/finance/sponsor-engine'
import { generateTalentPool, DEFAULT_STAFF_POOL_SIZE } from '@/engine/staff/talent-pool'
import type { DepartmentHead } from '@/types/team'
import { derivePulse, type PulseContext } from '@/engine/drivers/pulse'
import { computeScoutSignal } from '@/engine/drivers/scout-signal'
import { deriveBoardObjectives } from '@/engine/board/board-target'

/**
 * Default contract window (in seasons) applied to each department head at
 * game init. Staggered by role so not every contract expires at once —
 * mirrors how real teams bundle multi-year agreements.
 */
const STAFF_CONTRACT_LENGTH: Record<DepartmentHead['role'], number> = {
  'technical-director': 4,
  'race-engineer': 2,
  'commercial-director': 3,
  'team-manager': 5,
}

/** Accepts either fully-typed DepartmentHead (mid-game) or data-file rows
 * lacking `contractEndSeason`, and emits a fully hydrated DepartmentHead. */
function hydrateStaff(
  staff: readonly (DepartmentHead | Omit<DepartmentHead, 'contractEndSeason'>)[],
  startingSeason: number,
): DepartmentHead[] {
  return staff.map(head => {
    const hasContract = 'contractEndSeason' in head && typeof head.contractEndSeason === 'number'
    const contractEndSeason = hasContract
      ? (head as DepartmentHead).contractEndSeason
      : startingSeason + STAFF_CONTRACT_LENGTH[head.role]
    return { ...head, contractEndSeason }
  })
}

export interface FullGameState {
  gameState: GameState
  teams: Team[]
  drivers: Driver[]
  calendar: Race[]
  finance: Record<string, FinanceState>
  narrativeEvents: NarrativeEvent[]
  storyArcs: StoryArc[]
  recommendations: Recommendation[]
  stagedStrategies: StagedStrategies
  /** Tier B v2 — season-scoped procgen free-agent pool of pit-crew staff. */
  staffMarket: import('@/types/staff').StaffMarket
  /** Tier B v2 — open / resolved poaching attempts (logic ships IP-B3). */
  poachingAttempts: import('@/types/staff').PoachingAttempt[]
  /** Board Objectives — player-only season mandate + live confidence + verdict. */
  boardExpectations: import('@/types/board').BoardExpectations
}

function applyScenarioToTeam(team: TeamData, scenario: ReturnType<typeof SCENARIOS['find']>, startingSeason: number): Team {
  const s = scenario!
  const carMod = s.carPerformanceModifier
  const morale = Math.max(0, Math.min(100, team.morale + s.moraleModifier))
  return {
    ...team,
    staff: hydrateStaff(team.staff, startingSeason),
    car: {
      downforce: Math.max(0, Math.min(100, team.car.downforce + carMod)),
      straightSpeed: Math.max(0, Math.min(100, team.car.straightSpeed + carMod)),
      reliability: Math.max(0, Math.min(100, team.car.reliability + carMod)),
      tireManagement: Math.max(0, Math.min(100, team.car.tireManagement + carMod)),
      braking: Math.max(0, Math.min(100, team.car.braking + carMod)),
      cornering: Math.max(0, Math.min(100, team.car.cornering + carMod)),
    },
    morale,
    rndUpgrades: RND_TREE.map(template => ({
      ...template,
      progress: 0,
      status: template.prerequisiteIds.length === 0 ? 'available' as const : 'locked' as const,
    })),
    constructorPoints: 0,
    constructorPosition: 0,
    previousConstructorPosition: 0,
    previousMorale: morale,
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

function buildTeam(teamData: TeamData, startingSeason: number): Team {
  return {
    ...teamData,
    staff: hydrateStaff(teamData.staff, startingSeason),
    rndUpgrades: RND_TREE.map(template => ({
      ...template,
      progress: 0,
      status: template.prerequisiteIds.length === 0 ? 'available' as const : 'locked' as const,
    })),
    constructorPoints: 0,
    constructorPosition: 0,
    previousConstructorPosition: 0,
    previousMorale: teamData.morale,
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

function createInitialFinance(budgetModifier: number, prestige: string): FinanceState {
  const prestigeRating = prestige as PrestigeRating

  // Assign initial sponsors based on prestige. Sponsors are per-team contracts
  // and only the player's are ever surfaced (the KPI loop is player-only), so
  // each team draws independently from its full prestige-appropriate pool.
  // A previous shared used-id set, consumed in TEAMS order, starved every
  // low-prestige team: the premium teams drained all 6 minor templates first,
  // leaving ~6 teams with zero sponsors and the sponsor KPI loop inert for them.
  const available = getAvailableSponsors(SPONSORS, prestigeRating, [])

  // Pick 1 title (if available), 1-2 major, 1-2 minor
  const titleSponsors = available.filter(s => s.tier === 'title')
  const majorSponsors = available.filter(s => s.tier === 'major')
  const minorSponsors = available.filter(s => s.tier === 'minor')

  const picked: typeof available = []
  if (titleSponsors.length > 0) picked.push(titleSponsors[0])
  picked.push(...majorSponsors.slice(0, 2))
  picked.push(...minorSponsors.slice(0, 2))

  const sponsors = picked.map(t => signSponsor(t, 1))

  return {
    budget: {
      cap: 215_000_000,
      totalSpent: 0,
      categories: [
        { name: 'R&D', allocated: 80_000_000 * budgetModifier, spent: 0 },
        { name: 'Salaries', allocated: 60_000_000 * budgetModifier, spent: 0 },
        { name: 'Operations', allocated: 45_000_000 * budgetModifier, spent: 0 },
        { name: 'Marketing', allocated: 15_000_000 * budgetModifier, spent: 0 },
        { name: 'Facilities', allocated: 15_000_000 * budgetModifier, spent: 0 },
      ],
      projectedEndOfSeason: 200_000_000 * budgetModifier,
      penaltyRisk: false,
    },
    sponsors,
    prestige: prestigeRating,
    prestigeScore: prestigeToScore(prestige),
    prizeMoneyEstimate: 0,
    marketingBudget: 15_000_000 * budgetModifier,
    bankedBonuses: 0,
  }
}

function prestigeToScore(prestige: string): number {
  const map: Record<string, number> = {
    'A+': 95, 'A': 85, 'B+': 75, 'B': 65, 'C+': 55, 'C': 45, 'D': 30, 'F': 15,
  }
  return map[prestige] ?? 50
}

function defaultPrestigeForTeam(teamId: string): string {
  const top = ['mclaren', 'red-bull', 'ferrari']
  const upperMid = ['mercedes', 'aston-martin']
  const mid = ['williams', 'racing-bulls', 'alpine']
  if (top.includes(teamId)) return 'A'
  if (upperMid.includes(teamId)) return 'B+'
  if (mid.includes(teamId)) return 'C+'
  return 'C'
}

export function initializeGame(
  teamId: string,
  scenarioType: ScenarioType,
  seed: number,
): FullGameState {
  const scenario = SCENARIOS.find(s => s.id === scenarioType)!

  const startingSeason = 1
  const teams: Team[] = TEAMS.map(teamData => {
    if (teamData.id === teamId) {
      return applyScenarioToTeam(teamData, scenario, startingSeason)
    }
    return buildTeam(teamData, startingSeason)
  })

  const driversWithRuntime: Driver[] = DRIVERS.map(d => ({
    ...d,
    form: [],
    lastRaceResult: null,
  }))
  // Synthetic first-init pulse + scoutSignal pass. Career stats are
  // pre-seeded in `data/drivers.ts`; we do not synthesize them here.
  const initCtx: PulseContext = {
    championshipPositionByDriverId: {},
    championshipGapByDriverId: {},
    totalDriversInChampionship: driversWithRuntime.length,
    currentRound: 1,
    currentSeason: 1,
  }
  const drivers: Driver[] = driversWithRuntime.map(d => ({
    ...d,
    pulse: derivePulse(d, initCtx),
    scoutSignal: computeScoutSignal(d),
  }))

  const finance: Record<string, FinanceState> = {}
  for (const team of TEAMS) {
    const isPlayer = team.id === teamId
    const budgetMod = isPlayer ? scenario.budgetModifier : 1.0
    const prestige = isPlayer && scenario.prestigeOverride
      ? scenario.prestigeOverride
      : defaultPrestigeForTeam(team.id)
    finance[team.id] = createInitialFinance(budgetMod, prestige)
  }

  const { objectives, rivalTeamId } = deriveBoardObjectives(
    teamId, teams, scenario, CALENDAR.length,
  )
  const boardExpectations: import('@/types/board').BoardExpectations = {
    objectives,
    rivalTeamId,
    confidence: 50,
    confidenceHistory: [],
    warningsIssued: 0,
    tenureStatus: 'active',
    verdict: null,
    lastProcessedRound: -1,
  }

  return {
    gameState: {
      season: 1,
      currentRound: 1,
      phase: 'management',
      playerTeamId: teamId,
      scenario: scenarioType,
      seed,
      totalRaces: CALENDAR.length,
    },
    teams,
    drivers,
    calendar: CALENDAR.map(r => ({ ...r })),
    finance,
    narrativeEvents: [],
    storyArcs: [],
    recommendations: [],
    stagedStrategies: {},
    // Tier B v2 — staff market gets populated by `generateTalentPool` once
    // the engine module exists (Task 6). For IP-B2 init this is the stub.
    staffMarket: generateTalentPool(seed, 1, DEFAULT_STAFF_POOL_SIZE),
    poachingAttempts: [],
    boardExpectations,
  }
}

// Phase transitions
const STANDARD_FLOW: Phase[] = ['management', 'practice', 'qualifying', 'race', 'post-race']
const SPRINT_FLOW: Phase[] = ['management', 'practice', 'sprint-qualifying', 'sprint', 'qualifying', 'race', 'post-race']

export function advancePhase(state: FullGameState): FullGameState {
  const { gameState, calendar } = state
  const currentRace = calendar[gameState.currentRound - 1]
  const flow = currentRace.isSprint ? SPRINT_FLOW : STANDARD_FLOW
  const currentIndex = flow.indexOf(gameState.phase)

  if (currentIndex === -1 || currentIndex >= flow.length - 1) {
    // End of weekend — advance to next round or season end
    const nextRound = gameState.currentRound + 1
    if (nextRound > gameState.totalRaces) {
      return {
        ...state,
        gameState: { ...gameState, phase: 'season-end' },
      }
    }
    return {
      ...state,
      gameState: {
        ...gameState,
        currentRound: nextRound,
        phase: 'management',
      },
    }
  }

  return {
    ...state,
    gameState: {
      ...gameState,
      phase: flow[currentIndex + 1],
    },
  }
}
