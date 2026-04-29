import type { FullGameState } from './state-manager'
import { advancePhase } from './state-manager'
import { createPRNG } from './prng'
import { processRnDCycle } from '@/engine/engineering/rnd-engine'
import { processAllAITeams } from '@/engine/ai/ai-team-engine'
import { processPostRace, type RaceResult } from './post-race-processor'
import { processSeasonEnd } from './season-end-processor'
import { applyTechnicalDirective, getTechnicalDirectives } from '@/engine/regulations/regulation-engine'
import { generateRecommendations } from '@/engine/delegation/department-ai'
import { applyPendingSwaps } from '@/engine/engineering/component-strategy'
import {
  consumeAeroBudget,
  resetAeroWindow,
  snapshotUpgradePrediction,
  UPGRADE_OUTCOMES_CAP,
} from '@/engine/engineering/aero-budget'
import { windowResetsIn } from '@/engine/engineering/factory-insights'

/**
 * Process management-phase entry: R&D cycles, technical directives, AI teams.
 * Pure function — no side effects, fully deterministic given the same world state.
 */
export function processManagementEntry(world: FullGameState): FullGameState {
  const rng = createPRNG(world.gameState.seed + world.gameState.currentRound)
  const currentRound = world.gameState.currentRound

  // Phase 3 (Box 3): CDT-window reset at the boundary, then aero-budget
  // consumption tied to the player's in-progress upgrades. Stalled
  // upgrade ids skip their progress tick this cycle (no progress, no spend).
  const playerTeamRaw = world.teams.find(t => t.id === world.gameState.playerTeamId)!
  const daysToReset = windowResetsIn(currentRound)
  const teamWithReset = daysToReset === 0 ? resetAeroWindow(playerTeamRaw) : playerTeamRaw
  const todayIndex = Math.max(0, Math.min(13, 13 - daysToReset))
  const { team: teamAfterBudget, stalledUpgradeIds } = consumeAeroBudget(teamWithReset, todayIndex)
  const stallSet = new Set(stalledUpgradeIds)
  const playerTeam = teamAfterBudget

  // Process player team R&D — stalled upgrades are skipped this cycle.
  const updatedUpgrades = processRnDCycle(playerTeam.rndUpgrades, 1.0, stallSet)
  // Detect newly completed upgrades. Transition is one-way; upgrade ids are
  // stable, so a status flip from non-complete → complete at the same index
  // identifies the deliveries this cycle.
  const newlyCompletedUpgrades = updatedUpgrades.filter((u, i) =>
    u.status === 'complete' && playerTeam.rndUpgrades[i]?.status !== 'complete',
  )
  const anyNewlyCompleted = newlyCompletedUpgrades.length > 0
  // Phase 3 (Box 3): snapshot the predicted-vs-actual prediction for each
  // freshly-shipped upgrade. `actualOvrDelta` fills after the next race.
  let nextOutcomes = playerTeam.upgradeOutcomes
  for (const u of newlyCompletedUpgrades) {
    const snapshot = snapshotUpgradePrediction(playerTeam, u.id, currentRound)
    if (snapshot) nextOutcomes = [...nextOutcomes, snapshot].slice(-UPGRADE_OUTCOMES_CAP)
  }
  let updatedTeams = world.teams.map(t =>
    t.id === playerTeam.id
      ? {
        ...t,
        windTunnelHoursUsed: playerTeam.windTunnelHoursUsed,
        cfdRunsUsed: playerTeam.cfdRunsUsed,
        aeroBookings: playerTeam.aeroBookings,
        rndUpgrades: updatedUpgrades,
        upgradeOutcomes: nextOutcomes,
        lastUpgradeRound: anyNewlyCompleted ? currentRound : t.lastUpgradeRound,
      }
      : t,
  )

  // Check for mid-season technical directives
  const directives = getTechnicalDirectives(world.gameState.season, world.gameState.currentRound)
  const prevDirectives = getTechnicalDirectives(world.gameState.season, world.gameState.currentRound - 1)
  const newDirectives = directives.filter(d => !prevDirectives.some(pd => pd.id === d.id))
  for (const directive of newDirectives) {
    updatedTeams = applyTechnicalDirective(updatedTeams, directive)
  }

  // Process AI teams
  const aiResult = processAllAITeams(
    updatedTeams, world.drivers, world.gameState.playerTeamId, rng
  )

  // Stamp lastUpgradeRound for AI teams that shipped an upgrade this cycle.
  // Keeps the AI engine signature frozen: the R&D status diff is computed
  // here rather than threaded through `aiTeamManagementPhase`.
  const aiTeamsStamped = aiResult.teams.map(team => {
    if (team.id === world.gameState.playerTeamId) return team
    const before = updatedTeams.find(t => t.id === team.id)
    if (!before) return team
    const newlyCompleted = team.rndUpgrades.some((u, i) =>
      u.status === 'complete' && before.rndUpgrades[i]?.status !== 'complete',
    )
    return newlyCompleted
      ? { ...team, lastUpgradeRound: world.gameState.currentRound }
      : team
  })

  const afterAI: FullGameState = {
    ...world,
    teams: aiTeamsStamped,
    drivers: aiResult.drivers,
  }

  // Delegation — generate recommendations last so they reflect the
  // post-R&D, post-AI state of the world. Uses a distinct PRNG seed offset
  // so a rerun of this step never reuses bits the prior engines consumed.
  const recRng = createPRNG(world.gameState.seed + world.gameState.currentRound + 7777)
  const recommendations = generateRecommendations(afterAI, recRng)

  return {
    ...afterAI,
    recommendations,
  }
}

/**
 * Advance the game phase, processing any entry logic for the new phase.
 * Pure function — returns the next world state.
 */
export function advanceGamePhase(world: FullGameState): FullGameState {
  const prevPhase = world.gameState.phase
  let next = advancePhase(world)

  // If we just entered management phase, run management entry processing
  if (next.gameState.phase === 'management' && prevPhase !== 'management') {
    next = processManagementEntry(next)
  }

  // Phase 2 (Box 2): drain elected component swaps at the management →
  // practice boundary. Folds per-driver grid penalties into the existing
  // Tier A `driver.nextRaceGridDrop` channel that the strategy page
  // already consumes via `applyGridDrops` after qualifying.
  if (prevPhase === 'management' && next.gameState.phase === 'practice') {
    next = drainPendingSwaps(next)
  }

  return next
}

/**
 * Drain every team's `pendingComponentSwaps`, increment shared element
 * counters, and add per-driver grid penalties to each affected driver's
 * `nextRaceGridDrop`. Pure — returns a new world.
 */
function drainPendingSwaps(world: FullGameState): FullGameState {
  let updatedTeams = world.teams
  let updatedDrivers = world.drivers
  for (const team of world.teams) {
    if (team.pendingComponentSwaps.length === 0) continue
    const result = applyPendingSwaps(team, updatedDrivers, world.gameState.currentRound)
    updatedTeams = updatedTeams.map((t) => t.id === team.id ? result.team : t)
    updatedDrivers = updatedDrivers.map((d) => {
      const penalty = result.gridPenaltyByDriver[d.id]
      return penalty ? { ...d, nextRaceGridDrop: d.nextRaceGridDrop + penalty } : d
    })
  }
  return { ...world, teams: updatedTeams, drivers: updatedDrivers }
}

export interface PostRaceOrchestratorResult {
  world: FullGameState
  eventCooldowns: Record<string, number>
}

/**
 * Process post-race updates: standings, moods, finance, narrative events.
 * Pure function — no side effects.
 */
export function processPostRacePhase(
  world: FullGameState,
  eventCooldowns: Record<string, number>,
  results: RaceResult[],
  fastestLap: { driverId: string; time: number } | null,
  isSprint: boolean,
): PostRaceOrchestratorResult {
  const rng = createPRNG(world.gameState.seed + world.gameState.currentRound + 999)
  const update = processPostRace(
    world.teams, world.drivers, world.finance,
    world.narrativeEvents, eventCooldowns,
    results, fastestLap, isSprint,
    world.gameState.currentRound,
    world.gameState.season,
    world.gameState.playerTeamId,
    rng,
  )

  return {
    world: {
      ...world,
      teams: update.teams,
      drivers: update.drivers,
      finance: update.finance,
      narrativeEvents: update.narrativeEvents,
    },
    eventCooldowns: update.eventCooldowns,
  }
}

/**
 * Process season end: prizes, aging, contracts, R&D reset, regulations.
 * Pure function — returns the next season's starting state.
 */
export function processSeasonEndPhase(world: FullGameState) {
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

  return { world: nextWorld, result }
}
