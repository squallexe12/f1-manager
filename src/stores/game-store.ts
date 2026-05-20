import { create } from 'zustand'
import { salariesSpent, type ContractOffer } from '@/engine/drivers/contract-engine'
import { setCategorySpent } from '@/engine/finance/budget-engine'
import type { ScenarioType } from '@/types/game'
import type {
  DriverCommand,
  RaceStrategy,
  TireCompound,
  RaceCommandEnvelope,
  SimSpeed,
  WorkerOutEvent,
} from '@/types/race'
import type { EventConsequence } from '@/types/narrative'
import type { ComponentElement } from '@/types/team'
import { initializeGame, type FullGameState } from '@/engine/core/state-manager'
import { startUpgrade, pauseUpgrade } from '@/engine/engineering/rnd-engine'
import { electComponentSwap as electComponentSwapEngine } from '@/engine/engineering/component-strategy'
import {
  hireChief as hireChiefEngine,
  fireChief as fireChiefEngine,
  hireMember as hireMemberEngine,
  fireMember as fireMemberEngine,
} from '@/engine/staff/hiring'
import { type RaceResult } from '@/engine/core/post-race-processor'
import { type SeasonEndResult } from '@/engine/core/season-end-processor'
import { advanceGamePhase, processPostRacePhase, processSeasonEndPhase } from '@/engine/core/orchestrator'
import { createRaceCommandBus, type RaceCommandBus } from '@/engine/race/race-command-bus'
import {
  boostSponsorSatisfaction,
  reduceDriverFrustration,
} from '@/engine/delegation/recommendation-helpers'
import type { Recommendation, StagedStrategies } from '@/types/delegation'
import {
  createInitialRaceRuntime,
  reduceWorkerEvent,
  type RaceRuntimeSlice,
  type RaceSimPhase,
  type WorkerStatus,
} from './race-runtime-slice'

interface GameStore {
  // World state (persisted via setupPersistence)
  world: FullGameState | null
  eventCooldowns: Record<string, number>
  lastRaceResults: RaceResult[] | null
  lastSeasonEnd: SeasonEndResult | null
  raceCommandBus: RaceCommandBus

  // Race runtime slice (session-scoped, NOT inside world — see IP-04 Race Slice
  // Ownership Decision in docs/architecture/current-state-baseline.md §3.1).
  raceRuntime: RaceRuntimeSlice

  // Actions — world
  initGame: (teamId: string, scenario: ScenarioType, seed?: number) => void
  advancePhase: () => void
  submitRaceResults: (
    results: RaceResult[],
    fastestLap: { driverId: string; time: number } | null,
    isSprint: boolean,
  ) => void
  processSeasonEnd: () => void
  allocateRnD: (upgradeId: string) => void
  pauseRnD: (upgradeId: string) => void
  electComponentSwap: (driverId: string, element: ComponentElement) => void
  /** Tier B v2 — hire a free-agent pit-crew chief by id. Auto-fires the existing chief if any. */
  hireStaffChief: (staffId: string) => void
  /** Tier B v2 — fire the currently employed pit-crew chief; returns to free-agent pool with attribute decay. */
  fireStaffChief: () => void
  /** Tier B v2 — hire a free-agent pit-crew member by id. Auto-fires any existing occupant of the same role. */
  hireStaffMember: (staffId: string) => void
  /** Tier B v2 — fire a roster pit-crew member by id; returns to free-agent pool with attribute decay. */
  fireStaffMember: (staffId: string) => void
  /** Tier B v2 — match a rival team's poaching offer; staff stays, salary bumps to offer. */
  matchPoachingOffer: (attemptId: string) => void
  /** Tier B v2 — decline a rival team's poaching offer; staff leaves at end of current season. */
  declinePoachingOffer: (attemptId: string) => void
  setDriverCommand: (driverId: string, command: DriverCommand) => RaceCommandEnvelope
  requestPit: (driverId: string, compound: TireCompound) => RaceCommandEnvelope
  changeDriverStrategy: (driverId: string, strategy: RaceStrategy) => RaceCommandEnvelope
  resolveEvent: (eventId: string, optionId: string, consequences: EventConsequence[]) => void
  applyRecommendation: (recommendationId: string) => void
  dismissRecommendation: (recommendationId: string) => void
  /**
   * Consumes the one-shot nextRaceGridDrop on the listed drivers (sets it to 0).
   * Called immediately before the race worker is started, after applyGridDrops
   * has already baked the drops into the starting grid order. Each drop fires
   * exactly once per race-start so the penalty is not double-applied on retry.
   */
  consumeGridDrops: (driverIds: string[]) => void
  /**
   * STUB (IP-09b) — open the contract renegotiation modal for the given
   * driver. No world mutation; logs intent only. Will be replaced when the
   * contract renegotiation flow ships.
   */
  openContractNegotiation: (driverId: string) => void
  signContract: (driverId: string, offer: ContractOffer) => void

  // Actions — race runtime
  applyRaceWorkerEvent: (event: WorkerOutEvent) => void
  setRaceWorkerStatus: (status: WorkerStatus) => void
  setRacePhase: (phase: RaceSimPhase) => void
  setRaceSimSpeed: (speed: SimSpeed) => void
  setDriverCommandLocal: (driverId: string, command: DriverCommand) => void
  resetRaceRuntime: () => void
}

/**
 * Routes a recommendation to the corresponding world mutation. Pure — returns
 * a new `FullGameState` (recommendation status unchanged here; the caller
 * stamps it to `'applied'`). Returns null if the action prefix is unknown or
 * the world cannot satisfy the request.
 */
function applyRecommendationAction(
  world: FullGameState,
  rec: Recommendation,
): FullGameState | null {
  const { action } = rec
  const playerTeamId = world.gameState.playerTeamId

  if (action.startsWith('start-rnd:')) {
    const upgradeId = action.slice('start-rnd:'.length)
    const teams = world.teams.map(t =>
      t.id !== playerTeamId ? t : { ...t, rndUpgrades: startUpgrade(t.rndUpgrades, upgradeId) },
    )
    return { ...world, teams }
  }

  if (action.startsWith('strategy:')) {
    const parsed = parseStrategyAction(action)
    if (!parsed) return null
    const race = world.calendar[world.gameState.currentRound - 1]
    if (!race) return null
    const compounds = race.circuit.compounds
    const playerDriverIds = world.drivers
      .filter(d => d.teamId === playerTeamId && !d.isReserve)
      .map(d => d.id)
    const staged: StagedStrategies = { ...world.stagedStrategies }
    for (const id of playerDriverIds) {
      staged[id] = {
        startCompound: compounds[1],
        stops: [{ lap: parsed.pitLap, compound: compounds[0] }],
      }
    }
    return { ...world, stagedStrategies: staged }
  }

  if (action === 'sponsor-outreach') {
    const finance = { ...world.finance }
    finance[playerTeamId] = boostSponsorSatisfaction(finance[playerTeamId])
    return { ...world, finance }
  }

  if (action.startsWith('driver-talk:')) {
    const driverId = action.slice('driver-talk:'.length)
    const drivers = reduceDriverFrustration(world.drivers, driverId)
    if (drivers === world.drivers) return null
    return { ...world, drivers }
  }

  return null
}

function parseStrategyAction(action: string): { pitLap: number } | null {
  const match = /^strategy:1-stop:lap-(\d+)$/.exec(action)
  if (!match) return null
  const pitLap = Number(match[1])
  if (!Number.isFinite(pitLap) || pitLap < 1) return null
  return { pitLap }
}

export const useGameStore = create<GameStore>((set, get) => ({
  world: null,
  eventCooldowns: {},
  lastRaceResults: null,
  lastSeasonEnd: null,
  raceCommandBus: createRaceCommandBus(),
  raceRuntime: createInitialRaceRuntime(),

  initGame: (teamId, scenario, seed) => {
    const gameSeed = seed ?? Math.floor(Math.random() * 1_000_000)
    const world = initializeGame(teamId, scenario, gameSeed)
    set({ world, lastRaceResults: null, lastSeasonEnd: null })
  },

  advancePhase: () => {
    const { world } = get()
    if (!world) return
    const prevPhase = world.gameState.phase
    const next = advanceGamePhase(world)
    // Clear race runtime when the weekend closes so next round's race phase
    // doesn't short-circuit to post-race on stale `finished` state.
    if (prevPhase === 'post-race' && next.gameState.phase !== 'post-race') {
      set({ world: next, raceRuntime: createInitialRaceRuntime() })
    } else {
      set({ world: next })
    }
  },

  submitRaceResults: (results, fastestLap, isSprint) => {
    const { world, eventCooldowns } = get()
    if (!world) return
    const update = processPostRacePhase(world, eventCooldowns, results, fastestLap, isSprint)
    set({ world: update.world, eventCooldowns: update.eventCooldowns, lastRaceResults: results })
  },

  processSeasonEnd: () => {
    const { world } = get()
    if (!world) return
    const { world: nextWorld, result } = processSeasonEndPhase(world)
    set({ world: nextWorld, lastSeasonEnd: result, lastRaceResults: null })
  },

  allocateRnD: (upgradeId) => {
    const { world } = get()
    if (!world) return
    const teams = world.teams.map(t => {
      if (t.id !== world.gameState.playerTeamId) return t
      return { ...t, rndUpgrades: startUpgrade(t.rndUpgrades, upgradeId) }
    })
    set({ world: { ...world, teams } })
  },

  pauseRnD: (upgradeId) => {
    const { world } = get()
    if (!world) return
    const teams = world.teams.map(t => {
      if (t.id !== world.gameState.playerTeamId) return t
      return { ...t, rndUpgrades: pauseUpgrade(t.rndUpgrades, upgradeId) }
    })
    set({ world: { ...world, teams } })
  },

  electComponentSwap: (driverId, element) => {
    const { world } = get()
    if (!world) return
    const playerTeamId = world.gameState.playerTeamId
    const currentRound = world.gameState.currentRound
    const teams = world.teams.map((t) =>
      t.id !== playerTeamId
        ? t
        : electComponentSwapEngine(t, driverId, element, currentRound),
    )
    set({ world: { ...world, teams } })
  },

  hireStaffChief: (staffId) => {
    const { world } = get()
    if (!world) return
    const playerTeamId = world.gameState.playerTeamId
    const playerTeam = world.teams.find((t) => t.id === playerTeamId)
    if (!playerTeam) return
    const result = hireChiefEngine(world.staffMarket, playerTeam.pitCrewChief, playerTeam.pitCrewMembers, staffId)
    const teams = world.teams.map((t) =>
      t.id !== playerTeamId
        ? t
        : { ...t, pitCrewChief: result.team.pitCrewChief, pitCrewMembers: result.team.pitCrewMembers },
    )
    set({ world: { ...world, teams, staffMarket: result.market } })
  },

  fireStaffChief: () => {
    const { world } = get()
    if (!world) return
    const playerTeamId = world.gameState.playerTeamId
    const playerTeam = world.teams.find((t) => t.id === playerTeamId)
    if (!playerTeam) return
    const result = fireChiefEngine(world.staffMarket, playerTeam.pitCrewChief, playerTeam.pitCrewMembers)
    const teams = world.teams.map((t) =>
      t.id !== playerTeamId
        ? t
        : { ...t, pitCrewChief: result.team.pitCrewChief, pitCrewMembers: result.team.pitCrewMembers },
    )
    set({ world: { ...world, teams, staffMarket: result.market } })
  },

  hireStaffMember: (staffId) => {
    const { world } = get()
    if (!world) return
    const playerTeamId = world.gameState.playerTeamId
    const playerTeam = world.teams.find((t) => t.id === playerTeamId)
    if (!playerTeam) return
    const result = hireMemberEngine(world.staffMarket, playerTeam.pitCrewChief, playerTeam.pitCrewMembers, staffId)
    const teams = world.teams.map((t) =>
      t.id !== playerTeamId
        ? t
        : { ...t, pitCrewChief: result.team.pitCrewChief, pitCrewMembers: result.team.pitCrewMembers },
    )
    set({ world: { ...world, teams, staffMarket: result.market } })
  },

  fireStaffMember: (staffId) => {
    const { world } = get()
    if (!world) return
    const playerTeamId = world.gameState.playerTeamId
    const playerTeam = world.teams.find((t) => t.id === playerTeamId)
    if (!playerTeam) return
    const result = fireMemberEngine(world.staffMarket, playerTeam.pitCrewChief, playerTeam.pitCrewMembers, staffId)
    const teams = world.teams.map((t) =>
      t.id !== playerTeamId
        ? t
        : { ...t, pitCrewChief: result.team.pitCrewChief, pitCrewMembers: result.team.pitCrewMembers },
    )
    set({ world: { ...world, teams, staffMarket: result.market } })
  },

  matchPoachingOffer: (attemptId) => {
    const { world } = get()
    if (!world) return
    const attempt = world.poachingAttempts.find((a) => a.id === attemptId)
    if (!attempt || attempt.status !== 'open') return
    const playerTeamId = world.gameState.playerTeamId
    const playerTeam = world.teams.find((t) => t.id === playerTeamId)
    if (!playerTeam) return
    // Bump the targeted staff's salary to match. Staff stays put.
    const teams = world.teams.map((t) => {
      if (t.id !== playerTeamId) return t
      let nextChief = t.pitCrewChief
      if (nextChief && nextChief.id === attempt.targetStaffId) {
        nextChief = { ...nextChief, contract: { ...nextChief.contract, salary: attempt.offeredSalary } }
      }
      const nextMembers = t.pitCrewMembers.map((m) =>
        m.id === attempt.targetStaffId
          ? { ...m, contract: { ...m.contract, salary: attempt.offeredSalary } }
          : m,
      )
      return { ...t, pitCrewChief: nextChief, pitCrewMembers: nextMembers }
    })
    const poachingAttempts = world.poachingAttempts.map((a) =>
      a.id === attemptId ? { ...a, status: 'matched' as const } : a,
    )
    set({ world: { ...world, teams, poachingAttempts } })
  },

  declinePoachingOffer: (attemptId) => {
    const { world } = get()
    if (!world) return
    const attempt = world.poachingAttempts.find((a) => a.id === attemptId)
    if (!attempt || attempt.status !== 'open') return
    // v2: mark declined. The "staff leaves at season end" mechanic ships in
    // IP-B4 polish (needs season-end processor wiring); for now declining is
    // notional — the attempt is closed and the staff stays until that polish
    // pass. Documented gap.
    const poachingAttempts = world.poachingAttempts.map((a) =>
      a.id === attemptId ? { ...a, status: 'declined' as const } : a,
    )
    set({ world: { ...world, poachingAttempts } })
  },

  setDriverCommand: (driverId, command) => {
    return get().raceCommandBus.dispatch({
      type: 'setCommand',
      driverId,
      payload: { command },
    })
  },

  requestPit: (driverId, compound) => {
    return get().raceCommandBus.dispatch({
      type: 'pit',
      driverId,
      payload: { compound },
    })
  },

  changeDriverStrategy: (driverId, strategy) => {
    return get().raceCommandBus.dispatch({
      type: 'strategyChange',
      driverId,
      payload: { strategy },
    })
  },

  resolveEvent: (eventId, _optionId, _consequences) => {
    const { world } = get()
    if (!world) return
    const narrativeEvents = world.narrativeEvents.map(e =>
      e.id === eventId ? { ...e, resolved: true } : e
    )
    set({ world: { ...world, narrativeEvents } })
  },

  applyRecommendation: (recommendationId) => {
    const { world } = get()
    if (!world) return
    const rec = world.recommendations.find(r => r.id === recommendationId)
    if (!rec || !rec.applicable || rec.status !== 'active') return
    const next = applyRecommendationAction(world, rec)
    if (!next) return
    set({
      world: {
        ...next,
        recommendations: next.recommendations.map(r =>
          r.id === recommendationId ? { ...r, status: 'applied' } : r,
        ),
      },
    })
  },

  dismissRecommendation: (recommendationId) => {
    const { world } = get()
    if (!world) return
    const rec = world.recommendations.find(r => r.id === recommendationId)
    if (!rec || rec.status !== 'active') return
    set({
      world: {
        ...world,
        recommendations: world.recommendations.map(r =>
          r.id === recommendationId ? { ...r, status: 'dismissed' } : r,
        ),
      },
    })
  },

  consumeGridDrops: (driverIds) => {
    const { world } = get()
    if (!world || driverIds.length === 0) return
    const idSet = new Set(driverIds)
    const drivers = world.drivers.map((d) =>
      idSet.has(d.id) && d.nextRaceGridDrop > 0
        ? { ...d, nextRaceGridDrop: 0 }
        : d,
    )
    set({ world: { ...world, drivers } })
  },

  openContractNegotiation: (driverId) => {
    // STUB — IP-09b: contract renegotiation flow not yet implemented.
    // Tracked in docs/architecture/current-state-baseline.md §Known stubs (IP-09b).
    console.info('[stub] openContractNegotiation', driverId)
    // Does NOT mutate world — autosave will not fire.
  },

  signContract: (driverId, offer) => {
    const { world } = get()
    if (!world) return
    const playerTeamId = world.gameState.playerTeamId

    const drivers = world.drivers.map((d) =>
      d.id === driverId
        ? {
            ...d,
            contract: {
              salary: offer.salary,
              termEndSeason: offer.termLength,
              performanceBonuses: offer.performanceBonuses,
              releaseClause: offer.releaseClause,
            },
          }
        : d,
    )

    const finance = { ...world.finance }
    const fs = finance[playerTeamId]
    finance[playerTeamId] = {
      ...fs,
      budget: setCategorySpent(fs.budget, 'Salaries', salariesSpent(drivers, playerTeamId)),
    }

    set({ world: { ...world, drivers, finance } })
  },

  applyRaceWorkerEvent: (event) => {
    set((state) => ({ raceRuntime: reduceWorkerEvent(state.raceRuntime, event) }))
  },

  setRaceWorkerStatus: (status) => {
    set((state) => ({ raceRuntime: { ...state.raceRuntime, workerStatus: status } }))
  },

  setRacePhase: (phase) => {
    set((state) => ({ raceRuntime: { ...state.raceRuntime, phase } }))
  },

  setRaceSimSpeed: (speed) => {
    set((state) => ({ raceRuntime: { ...state.raceRuntime, simSpeed: speed } }))
  },

  setDriverCommandLocal: (driverId, command) => {
    set((state) => ({
      raceRuntime: {
        ...state.raceRuntime,
        driverCommands: { ...state.raceRuntime.driverCommands, [driverId]: command },
      },
    }))
  },

  resetRaceRuntime: () => {
    set({ raceRuntime: createInitialRaceRuntime() })
  },
}))
