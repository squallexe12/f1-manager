import { create } from 'zustand'
import type { ScenarioType } from '@/types/game'
import type { DriverCommand, RaceStrategy, TireCompound, RaceCommandEnvelope } from '@/types/race'
import type { EventConsequence } from '@/types/narrative'
import { initializeGame, type FullGameState } from '@/engine/core/state-manager'
import { startUpgrade, pauseUpgrade } from '@/engine/engineering/rnd-engine'
import { type RaceResult } from '@/engine/core/post-race-processor'
import { type SeasonEndResult } from '@/engine/core/season-end-processor'
import { advanceGamePhase, processPostRacePhase, processSeasonEndPhase } from '@/engine/core/orchestrator'
import { createRaceCommandBus, type RaceCommandBus } from '@/engine/race/race-command-bus'

interface GameStore {
  // State
  world: FullGameState | null
  eventCooldowns: Record<string, number>
  lastRaceResults: RaceResult[] | null
  lastSeasonEnd: SeasonEndResult | null
  raceCommandBus: RaceCommandBus

  // Actions
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
}

export const useGameStore = create<GameStore>((set, get) => ({
  world: null,
  eventCooldowns: {},
  lastRaceResults: null,
  lastSeasonEnd: null,
  raceCommandBus: createRaceCommandBus(),

  initGame: (teamId, scenario, seed) => {
    const gameSeed = seed ?? Math.floor(Math.random() * 1_000_000)
    const world = initializeGame(teamId, scenario, gameSeed)
    set({ world, lastRaceResults: null, lastSeasonEnd: null })
  },

  advancePhase: () => {
    const { world } = get()
    if (!world) return
    set({ world: advanceGamePhase(world) })
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
}))
