import { create } from 'zustand'
import type { ScenarioType } from '@/types/game'
import type { DriverCommand, TireCompound, RaceStrategy } from '@/types/race'
import type { NarrativeEvent, EventConsequence } from '@/types/narrative'
import { initializeGame, advancePhase, type FullGameState } from '@/engine/core/state-manager'
import { SaveSystem } from '@/engine/core/save-system'
import { startUpgrade, pauseUpgrade, processRnDCycle } from '@/engine/engineering/rnd-engine'
import { processAllAITeams } from '@/engine/ai/ai-team-engine'
import { processPostRace, type RaceResult } from '@/engine/core/post-race-processor'
import { processSeasonEnd, type SeasonEndResult } from '@/engine/core/season-end-processor'
import { applyTechnicalDirective, getTechnicalDirectives } from '@/engine/regulations/regulation-engine'
import { createPRNG } from '@/engine/core/prng'

interface GameStore {
  // State
  world: FullGameState | null
  isLoading: boolean
  error: string | null
  eventCooldowns: Record<string, number>
  lastRaceResults: RaceResult[] | null
  lastSeasonEnd: SeasonEndResult | null

  // Actions
  initGame: (teamId: string, scenario: ScenarioType, seed?: number) => void
  advancePhase: () => void
  submitRaceResults: (results: RaceResult[], isSprint: boolean) => void
  processSeasonEnd: () => void
  allocateRnD: (upgradeId: string) => void
  pauseRnD: (upgradeId: string) => void
  setDriverCommand: (driverId: string, command: DriverCommand) => void
  resolveEvent: (eventId: string, optionId: string, consequences: EventConsequence[]) => void
  saveGame: (slotId: string, name: string) => Promise<void>
  loadGame: (slotId: string) => Promise<void>
  listSaves: () => Promise<{ slotId: string; name: string; timestamp: number }[]>
  deleteSave: (slotId: string) => Promise<void>
}

const saveSystem = typeof window !== 'undefined' ? new SaveSystem() : null

export const useGameStore = create<GameStore>((set, get) => ({
  world: null,
  isLoading: false,
  error: null,
  eventCooldowns: {},
  lastRaceResults: null,
  lastSeasonEnd: null,

  initGame: (teamId, scenario, seed) => {
    const gameSeed = seed ?? Math.floor(Math.random() * 1_000_000)
    const world = initializeGame(teamId, scenario, gameSeed)
    set({ world, error: null, lastRaceResults: null, lastSeasonEnd: null })
  },

  advancePhase: () => {
    const { world } = get()
    if (!world) return

    let nextWorld = advancePhase(world)

    // If entering management phase, process AI teams, R&D, and check for technical directives
    if (nextWorld.gameState.phase === 'management' && world.gameState.phase !== 'management') {
      const rng = createPRNG(nextWorld.gameState.seed + nextWorld.gameState.currentRound)

      // Process player team R&D
      const playerTeam = nextWorld.teams.find(t => t.id === nextWorld.gameState.playerTeamId)!
      const updatedUpgrades = processRnDCycle(playerTeam.rndUpgrades)
      let updatedTeams = nextWorld.teams.map(t =>
        t.id === playerTeam.id ? { ...t, rndUpgrades: updatedUpgrades } : t
      )

      // Check for mid-season technical directives
      const directives = getTechnicalDirectives(nextWorld.gameState.season, nextWorld.gameState.currentRound)
      const prevDirectives = getTechnicalDirectives(nextWorld.gameState.season, nextWorld.gameState.currentRound - 1)
      const newDirectives = directives.filter(d => !prevDirectives.some(pd => pd.id === d.id))
      for (const directive of newDirectives) {
        updatedTeams = applyTechnicalDirective(updatedTeams, directive)
      }

      // Process AI teams
      const aiResult = processAllAITeams(
        updatedTeams, nextWorld.drivers, nextWorld.gameState.playerTeamId, rng
      )

      nextWorld = {
        ...nextWorld,
        teams: aiResult.teams,
        drivers: aiResult.drivers,
      }
    }

    set({ world: nextWorld })

    // Auto-save on phase transitions
    if (saveSystem) {
      saveSystem.autoSave(nextWorld).catch(() => {})
    }
  },

  submitRaceResults: (results, isSprint) => {
    const { world, eventCooldowns } = get()
    if (!world) return

    const rng = createPRNG(world.gameState.seed + world.gameState.currentRound + 999)
    const update = processPostRace(
      world.teams, world.drivers, world.finance,
      world.narrativeEvents, eventCooldowns,
      results, isSprint,
      world.gameState.currentRound,
      world.gameState.playerTeamId,
      rng,
    )

    const nextWorld: FullGameState = {
      ...world,
      teams: update.teams,
      drivers: update.drivers,
      finance: update.finance,
      narrativeEvents: update.narrativeEvents,
    }

    set({
      world: nextWorld,
      eventCooldowns: update.eventCooldowns,
      lastRaceResults: results,
    })
  },

  processSeasonEnd: () => {
    const { world } = get()
    if (!world) return

    const result = processSeasonEnd(
      world.teams, world.drivers, world.finance,
      world.gameState.season,
    )

    const nextWorld: FullGameState = {
      ...world,
      gameState: {
        ...world.gameState,
        season: world.gameState.season + 1,
        currentRound: 1,
        phase: 'management',
      },
      teams: result.teams,
      drivers: result.drivers,
      finance: result.finance,
    }

    set({ world: nextWorld, lastSeasonEnd: result, lastRaceResults: null })

    if (saveSystem) {
      saveSystem.autoSave(nextWorld).catch(() => {})
    }
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
    const { world } = get()
    if (!world) return
    // This will be used during race simulation
    set({ world: { ...world } })
  },

  resolveEvent: (eventId, optionId, consequences) => {
    const { world } = get()
    if (!world) return

    const narrativeEvents = world.narrativeEvents.map(e => {
      if (e.id === eventId) {
        return { ...e, resolved: true }
      }
      return e
    })

    // Apply consequences (simplified — full implementation would modify team/driver state)
    set({ world: { ...world, narrativeEvents } })
  },

  saveGame: async (slotId, name) => {
    const { world } = get()
    if (!world || !saveSystem) return
    set({ isLoading: true })
    try {
      await saveSystem.saveToSlot(slotId, name, world)
      set({ isLoading: false })
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false })
    }
  },

  loadGame: async (slotId) => {
    if (!saveSystem) return
    set({ isLoading: true })
    try {
      const world = await saveSystem.loadFromSlot(slotId)
      set({ world, isLoading: false, error: null })
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false })
    }
  },

  listSaves: async () => {
    if (!saveSystem) return []
    return saveSystem.listSlots()
  },

  deleteSave: async (slotId) => {
    if (!saveSystem) return
    await saveSystem.deleteSlot(slotId)
  },
}))
