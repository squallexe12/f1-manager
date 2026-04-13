import { create } from 'zustand'
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
import { initializeGame, type FullGameState } from '@/engine/core/state-manager'
import { startUpgrade, pauseUpgrade } from '@/engine/engineering/rnd-engine'
import { type RaceResult } from '@/engine/core/post-race-processor'
import { type SeasonEndResult } from '@/engine/core/season-end-processor'
import { advanceGamePhase, processPostRacePhase, processSeasonEndPhase } from '@/engine/core/orchestrator'
import { createRaceCommandBus, type RaceCommandBus } from '@/engine/race/race-command-bus'
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
  submitRaceResults: (results: RaceResult[], isSprint: boolean) => void
  processSeasonEnd: () => void
  allocateRnD: (upgradeId: string) => void
  pauseRnD: (upgradeId: string) => void
  setDriverCommand: (driverId: string, command: DriverCommand) => RaceCommandEnvelope
  requestPit: (driverId: string, compound: TireCompound) => RaceCommandEnvelope
  changeDriverStrategy: (driverId: string, strategy: RaceStrategy) => RaceCommandEnvelope
  resolveEvent: (eventId: string, optionId: string, consequences: EventConsequence[]) => void

  // Actions — race runtime
  applyRaceWorkerEvent: (event: WorkerOutEvent) => void
  setRaceWorkerStatus: (status: WorkerStatus) => void
  setRacePhase: (phase: RaceSimPhase) => void
  setRaceSimSpeed: (speed: SimSpeed) => void
  setDriverCommandLocal: (driverId: string, command: DriverCommand) => void
  resetRaceRuntime: () => void
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

  submitRaceResults: (results, isSprint) => {
    const { world, eventCooldowns } = get()
    if (!world) return
    const update = processPostRacePhase(world, eventCooldowns, results, isSprint)
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
