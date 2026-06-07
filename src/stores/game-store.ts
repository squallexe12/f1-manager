import { create } from 'zustand'
import { salariesSpent, type ContractOffer } from '@/engine/drivers/contract-engine'
import { releaseDriver as releaseDriverEngine } from '@/engine/drivers/contract-release'
import { signFreeAgent as signFreeAgentEngine, type SigningParams } from '@/engine/drivers/free-agent-signing'
import { setCategorySpent } from '@/engine/finance/budget-engine'
import type { ScenarioType } from '@/types/game'
import type {
  CommentaryEntry,
  DriverCommand,
  RaceStrategy,
  TireCompound,
  RaceCommandEnvelope,
  SimSpeed,
  WeatherState,
  WorkerOutEvent,
} from '@/types/race'
import type { EventConsequence } from '@/types/narrative'
import type { ComponentElement } from '@/types/team'
import type {
  PracticeProgram,
  QualifyingResult,
  QualiDriverResult,
  QualiFormat,
  QualiSegment,
  QualiSegmentResult,
} from '@/types/weekend'
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
import {
  createInitialPracticeRuntime,
  reducePracticeEvent,
  type PracticeDriverLive,
  type PracticeRuntimeSlice,
} from './practice-runtime-slice'
import {
  createInitialQualiRuntime,
  reduceQualiEvent,
  type QualiRuntimeSlice,
} from './qualifying-runtime-slice'
import { runPracticeSession as runPracticeSessionEngine } from '@/engine/practice/practice-engine'
import { prepareWeekend, processPracticeExit } from '@/engine/core/orchestrator'

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
  // Practice + qualifying live-reveal slices — session-scoped siblings of
  // raceRuntime; never persisted (persistence contract §1). The durable weekend
  // state lives in world.weekendState; these only carry transient UI state.
  practiceRuntime: PracticeRuntimeSlice
  qualifyingRuntime: QualiRuntimeSlice

  // Actions — world
  initGame: (teamId: string, scenario: ScenarioType, seed?: number) => void
  advancePhase: () => void
  submitRaceResults: (
    results: RaceResult[],
    fastestLap: { driverId: string; time: number } | null,
    isSprint: boolean,
  ) => void
  processSeasonEnd: () => void
  clearSeasonEnd: () => void
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
  /** Persist a finished qualifying classification to world.weekendState (by
   *  format) and bump the pole-sitter's seasonStats.poles. Only Grand Prix
   *  qualifying earns an official pole — Sprint Qualifying does not. */
  commitQualifyingResult: (result: QualifyingResult) => void
  signContract: (driverId: string, offer: ContractOffer) => void
  /** Terminate a contracted player driver early — moves them to free agency and charges severance. */
  releaseDriver: (driverId: string) => void
  /** Sign a free agent into a roster slot (CAR-01/CAR-02/RESERVE), optionally displacing the occupant to free agency. Caller (hook) guarantees the offer was accepted and slot/displacement are consistent. */
  signFreeAgent: (params: SigningParams) => void

  // Actions — race runtime
  applyRaceWorkerEvent: (event: WorkerOutEvent) => void
  setRaceWorkerStatus: (status: WorkerStatus) => void
  setRacePhase: (phase: RaceSimPhase) => void
  setRaceSimSpeed: (speed: SimSpeed) => void
  setDriverCommandLocal: (driverId: string, command: DriverCommand) => void
  resetRaceRuntime: () => void

  // Actions — practice (world): commit an FP session's pre-computed result into
  // world.weekendState (accrues setup, decrements the shared tire-set ledger,
  // appends practiceResults). The FP index is DERIVED from practiceResults.length.
  runPracticeSession: (
    programByDriver: Record<string, PracticeProgram>,
    runCompoundByDriver: Record<string, TireCompound>,
  ) => void
  // Actions — practice runtime (transient; never touch world / autosave)
  startPracticeSession: (drivers: PracticeDriverLive[], timeBudget: number) => void
  tickPractice: (deltaSeconds: number) => void
  pausePractice: () => void
  resumePractice: () => void
  setPracticeSpeed: (speed: SimSpeed) => void
  selectPracticeRunPlan: (driverId: string, program: PracticeProgram | null) => void
  selectPracticeTire: (driverId: string, compound: TireCompound) => void
  revealPracticeProgress: (driverId: string, setupConfidence: number, tireDegRead: number, lapsCompleted: number) => void
  pushPracticeCommentary: (entries: CommentaryEntry[]) => void
  advancePracticeSubSession: () => void
  resetPracticeRuntime: () => void

  // Actions — qualifying runtime (transient; never touch world / autosave).
  // The earned grid is committed via commitQualifyingResult (world action above).
  initQualiSession: (format: QualiFormat) => void
  advanceQualiSegment: (args: {
    segment: QualiSegment
    entrants: string[]
    cutlinePosition: number
    weather: WeatherState
    timeBudget: number
  }) => void
  tickQuali: (deltaSeconds: number) => void
  pauseQuali: () => void
  resumeQuali: () => void
  setQualiSpeed: (speed: SimSpeed) => void
  selectQualiTire: (driverId: string, compound: TireCompound) => void
  sendQualiLap: (driverId: string) => void
  abortQualiLap: (driverId: string) => void
  revealQualiAttempt: (result: QualiDriverResult) => void
  endQualiSegment: (result: QualiSegmentResult) => void
  pushQualiCommentary: (entries: CommentaryEntry[]) => void
  finaliseQualiGrid: (classification: QualifyingResult) => void
  resetQualiRuntime: () => void
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
  practiceRuntime: createInitialPracticeRuntime(),
  qualifyingRuntime: createInitialQualiRuntime(),

  initGame: (teamId, scenario, seed) => {
    const gameSeed = seed ?? Math.floor(Math.random() * 1_000_000)
    const world = initializeGame(teamId, scenario, gameSeed)
    set({ world, lastRaceResults: null, lastSeasonEnd: null })
  },

  advancePhase: () => {
    const { world } = get()
    if (!world) return
    const prevPhase = world.gameState.phase
    let next = advanceGamePhase(world)
    const nextPhase = next.gameState.phase

    // Weekend bootstrap: (re-)seed the weekend bundle (tire ledger + per-driver
    // setup) when entering practice. M1 export, wired here per the plan (§M4).
    if (prevPhase === 'management' && nextPhase === 'practice') {
      next = prepareWeekend(next)
    }
    // Practice exit: backfill the skip-default baseline for any player racer who
    // ran zero FP sessions, so the grid never inherits a blank setup. Idempotent.
    if (prevPhase === 'practice' && (nextPhase === 'qualifying' || nextPhase === 'sprint-qualifying')) {
      next = processPracticeExit(next)
    }

    // Clear ALL session-scoped runtimes when the weekend closes so next round's
    // race/practice/qualifying phases don't short-circuit on stale state.
    if (prevPhase === 'post-race' && nextPhase !== 'post-race') {
      set({
        world: next,
        raceRuntime: createInitialRaceRuntime(),
        practiceRuntime: createInitialPracticeRuntime(),
        qualifyingRuntime: createInitialQualiRuntime(),
      })
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

  // Dismiss the season-end recap so the player returns to the (now advanced)
  // management paddock. Session-scoped only — lastSeasonEnd is never persisted.
  clearSeasonEnd: () => set({ lastSeasonEnd: null }),

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

  commitQualifyingResult: (result) => {
    const { world } = get()
    if (!world) return
    const isSprint = result.format === 'sprint-qualifying'
    const weekendState = isSprint
      ? { ...world.weekendState, sprintQualifyingResult: result }
      : { ...world.weekendState, qualifyingResult: result }
    // Only the Grand Prix qualifying pole counts toward seasonStats.poles — a
    // Sprint Qualifying win does not earn an official career pole.
    const drivers = isSprint
      ? world.drivers
      : world.drivers.map((d) =>
          d.id === result.pole.driverId
            ? { ...d, seasonStats: { ...d.seasonStats, poles: d.seasonStats.poles + 1 } }
            : d,
        )
    set({ world: { ...world, weekendState, drivers } })
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

  releaseDriver: (driverId) => {
    const { world } = get()
    if (!world) return
    const { world: next } = releaseDriverEngine(world, world.gameState.playerTeamId, driverId)
    set({ world: next })
  },

  signFreeAgent: (params) => {
    const { world } = get()
    if (!world) return
    const playerTeamId = world.gameState.playerTeamId
    const { world: next } = signFreeAgentEngine(world, playerTeamId, params)
    const finance = { ...next.finance }
    const fs = finance[playerTeamId]
    finance[playerTeamId] = {
      ...fs,
      budget: setCategorySpent(fs.budget, 'Salaries', salariesSpent(next.drivers, playerTeamId)),
    }
    set({ world: { ...next, finance } })
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

  runPracticeSession: (programByDriver, runCompoundByDriver) => {
    const { world } = get()
    if (!world) return
    const { playerTeamId, currentRound, season, seed } = world.gameState
    const race = world.calendar[currentRound - 1]
    if (!race) return
    const ws = world.weekendState
    // Engine input: player racers only, in stable roster order (the engine skips
    // non-players, so passing only racers yields an identical PRNG stream). The
    // active FP index is DERIVED from the persisted result count, never trusted
    // from a caller — a reload mid-practice can never re-run a completed FP.
    // Every filtered driver is on the player team, so they all share its car.
    // Guard-clause (not a non-null assertion) so a corrupted playerTeamId is a
    // graceful no-op, mirroring the early returns above and elsewhere in the store.
    const playerTeam = world.teams.find((t) => t.id === playerTeamId)
    if (!playerTeam) return
    const drivers = world.drivers
      .filter((d) => d.teamId === playerTeamId && !d.isReserve && !d.isF2)
      .map((d) => ({ id: d.id, car: playerTeam.car, attributes: d.attributes, isPlayer: true }))
    const sessionIndex = Math.min(2, ws.practiceResults.length) as 0 | 1 | 2

    const { result, nextSetup, nextLedger } = runPracticeSessionEngine({
      sessionIndex,
      programByDriver,
      runCompoundByDriver,
      drivers,
      setup: ws.driverSetup,
      ledger: ws.tireLedger,
      circuitId: race.circuit.id,
      round: currentRound,
      season,
      worldSeed: seed,
      // Cosmetic stamp only — never fed to the PRNG (the engine's determinism
      // derives solely from worldSeed + round + sessionIndex).
      completedAt: new Date().toISOString(),
    })

    set({
      world: {
        ...world,
        weekendState: {
          ...ws,
          driverSetup: nextSetup,
          tireLedger: nextLedger,
          practiceResults: [...ws.practiceResults, result],
        },
      },
    })
  },

  startPracticeSession: (drivers, timeBudget) => {
    set((s) => ({
      practiceRuntime: reducePracticeEvent(s.practiceRuntime, {
        type: 'start',
        // Source of truth is the persisted result count, not a transient counter.
        sessionIndex: s.world?.weekendState.practiceResults.length ?? 0,
        timeBudget,
        drivers,
      }),
    }))
  },
  tickPractice: (deltaSeconds) => {
    set((s) => ({ practiceRuntime: reducePracticeEvent(s.practiceRuntime, { type: 'tick', deltaSeconds }) }))
  },
  pausePractice: () => {
    set((s) => ({ practiceRuntime: reducePracticeEvent(s.practiceRuntime, { type: 'pause' }) }))
  },
  resumePractice: () => {
    set((s) => ({ practiceRuntime: reducePracticeEvent(s.practiceRuntime, { type: 'resume' }) }))
  },
  setPracticeSpeed: (speed) => {
    set((s) => ({ practiceRuntime: reducePracticeEvent(s.practiceRuntime, { type: 'setSpeed', speed }) }))
  },
  selectPracticeRunPlan: (driverId, program) => {
    set((s) => ({ practiceRuntime: reducePracticeEvent(s.practiceRuntime, { type: 'selectRunPlan', driverId, program }) }))
  },
  selectPracticeTire: (driverId, compound) => {
    set((s) => ({ practiceRuntime: reducePracticeEvent(s.practiceRuntime, { type: 'selectTire', driverId, compound }) }))
  },
  revealPracticeProgress: (driverId, setupConfidence, tireDegRead, lapsCompleted) => {
    set((s) => ({
      practiceRuntime: reducePracticeEvent(s.practiceRuntime, { type: 'progress', driverId, setupConfidence, tireDegRead, lapsCompleted }),
    }))
  },
  pushPracticeCommentary: (entries) => {
    set((s) => ({ practiceRuntime: reducePracticeEvent(s.practiceRuntime, { type: 'commentary', entries }) }))
  },
  advancePracticeSubSession: () => {
    // Return the live slice to idle for the next FP, mirroring the persisted FP
    // index. Sim speed carries over for UX continuity.
    set((s) => ({
      practiceRuntime: {
        ...createInitialPracticeRuntime(),
        sessionIndex: s.world?.weekendState.practiceResults.length ?? 0,
        simSpeed: s.practiceRuntime.simSpeed,
      },
    }))
  },
  resetPracticeRuntime: () => {
    set({ practiceRuntime: createInitialPracticeRuntime() })
  },

  initQualiSession: (format) => {
    set((s) => ({ qualifyingRuntime: reduceQualiEvent(s.qualifyingRuntime, { type: 'init', format }) }))
  },
  advanceQualiSegment: (args) => {
    set((s) => ({ qualifyingRuntime: reduceQualiEvent(s.qualifyingRuntime, { type: 'segmentStart', ...args }) }))
  },
  tickQuali: (deltaSeconds) => {
    set((s) => ({ qualifyingRuntime: reduceQualiEvent(s.qualifyingRuntime, { type: 'tick', deltaSeconds }) }))
  },
  pauseQuali: () => {
    set((s) => ({ qualifyingRuntime: reduceQualiEvent(s.qualifyingRuntime, { type: 'pause' }) }))
  },
  resumeQuali: () => {
    set((s) => ({ qualifyingRuntime: reduceQualiEvent(s.qualifyingRuntime, { type: 'resume' }) }))
  },
  setQualiSpeed: (speed) => {
    set((s) => ({ qualifyingRuntime: reduceQualiEvent(s.qualifyingRuntime, { type: 'setSpeed', speed }) }))
  },
  selectQualiTire: (driverId, compound) => {
    set((s) => ({ qualifyingRuntime: reduceQualiEvent(s.qualifyingRuntime, { type: 'selectTire', driverId, compound }) }))
  },
  sendQualiLap: (driverId) => {
    set((s) => ({ qualifyingRuntime: reduceQualiEvent(s.qualifyingRuntime, { type: 'sendLap', driverId }) }))
  },
  abortQualiLap: (driverId) => {
    set((s) => ({ qualifyingRuntime: reduceQualiEvent(s.qualifyingRuntime, { type: 'abortLap', driverId }) }))
  },
  revealQualiAttempt: (result) => {
    set((s) => ({ qualifyingRuntime: reduceQualiEvent(s.qualifyingRuntime, { type: 'revealAttempt', result }) }))
  },
  endQualiSegment: (result) => {
    set((s) => ({ qualifyingRuntime: reduceQualiEvent(s.qualifyingRuntime, { type: 'segmentEnd', result }) }))
  },
  pushQualiCommentary: (entries) => {
    set((s) => ({ qualifyingRuntime: reduceQualiEvent(s.qualifyingRuntime, { type: 'commentary', entries }) }))
  },
  finaliseQualiGrid: (classification) => {
    set((s) => ({ qualifyingRuntime: reduceQualiEvent(s.qualifyingRuntime, { type: 'finalise', classification }) }))
  },
  resetQualiRuntime: () => {
    set({ qualifyingRuntime: createInitialQualiRuntime() })
  },
}))
