import type { Team } from '@/types/team'
import type { Driver } from '@/types/driver'
import type { FinanceState } from '@/types/finance'
import type { NarrativeEvent, EventConsequence } from '@/types/narrative'
import type { PRNG } from '@/engine/core/prng'
import { updateMood, type MoodEvent } from '@/engine/drivers/mood-system'
import { pushForm, pushOvrSample, FORM_DNF } from '@/engine/drivers/form-history'
import { calculateOverallRating } from '@/engine/engineering/car-performance'
import { recordSpend } from '@/engine/finance/budget-engine'
import { calculatePrestigeScore, scoreToRating } from '@/engine/finance/prestige'
import { generateEvents, resolveExpiredEvents, type GameContext } from '@/engine/narrative/event-generator'

// Points per position (standard race)
const RACE_POINTS: Record<number, number> = {
  1: 25, 2: 18, 3: 15, 4: 12, 5: 10,
  6: 8, 7: 6, 8: 4, 9: 2, 10: 1,
}

// Sprint points
const SPRINT_POINTS: Record<number, number> = {
  1: 8, 2: 7, 3: 6, 4: 5, 5: 4,
  6: 3, 7: 2, 8: 1,
}

export interface RaceResult {
  driverId: string
  position: number
  dnf: boolean
  fastestLap: boolean
}

export interface PostRaceUpdate {
  teams: Team[]
  drivers: Driver[]
  finance: Record<string, FinanceState>
  narrativeEvents: NarrativeEvent[]
  eventCooldowns: Record<string, number>
}

/**
 * Process all post-race updates: standings, moods, finance, narrative events.
 */
export function processPostRace(
  teams: Team[],
  drivers: Driver[],
  finance: Record<string, FinanceState>,
  narrativeEvents: NarrativeEvent[],
  eventCooldowns: Record<string, number>,
  results: RaceResult[],
  isSprint: boolean,
  currentRound: number,
  playerTeamId: string,
  rng: PRNG,
): PostRaceUpdate {
  const pointsTable = isSprint ? SPRINT_POINTS : RACE_POINTS

  // 1. Update driver season stats and points.
  //    Idempotency guard (see SeasonStats.lastProcessedRound) skips drivers
  //    whose stats were already credited for `currentRound` — defends against
  //    any double-fire of submitRaceResults.
  let updatedDrivers = drivers.map(driver => {
    const result = results.find(r => r.driverId === driver.id)
    if (!result) return driver
    if (driver.seasonStats.lastProcessedRound >= currentRound) return driver

    const points = pointsTable[result.position] ?? 0
    const fastestLapBonus = result.fastestLap && result.position <= 10 ? 1 : 0

    const stats = { ...driver.seasonStats }
    stats.points += points + fastestLapBonus
    if (result.position === 1) stats.wins++
    if (result.position <= 3) stats.podiums++
    if (result.dnf) stats.dnfs++
    if (!result.dnf && (stats.bestFinish === 0 || result.position < stats.bestFinish)) {
      stats.bestFinish = result.position
    }
    // Running average over rounds actually completed. Uses `currentRound` as
    // the denominator — the prior formula conflated wins/podiums/dnfs with
    // race count and under-counted whenever a driver podiumed.
    const completedRounds = Math.max(1, currentRound)
    stats.averageFinish = completedRounds === 1
      ? result.position
      : Math.round(
        ((stats.averageFinish * (completedRounds - 1)) + result.position)
        / completedRounds * 10,
      ) / 10
    stats.lastProcessedRound = currentRound

    const formSample = result.dnf ? FORM_DNF : result.position
    return {
      ...driver,
      seasonStats: stats,
      form: pushForm(driver.form, formSample),
      lastRaceResult: result.dnf ? null : result.position,
    }
  })

  // 2. Update driver moods
  updatedDrivers = updatedDrivers.map(driver => {
    const result = results.find(r => r.driverId === driver.id)
    if (!result) return driver

    const moodEvents: MoodEvent[] = []
    if (result.position === 1) moodEvents.push({ type: 'race-win' })
    else if (result.position <= 3) moodEvents.push({ type: 'podium' })
    else if (result.position <= 10) moodEvents.push({ type: 'points-finish' })
    if (result.dnf) moodEvents.push({ type: 'dnf' })

    // Teammate comparison
    const teammate = updatedDrivers.find(d =>
      d.id !== driver.id && d.teamId === driver.teamId && !d.isReserve
    )
    if (teammate) {
      const teammateResult = results.find(r => r.driverId === teammate.id)
      if (teammateResult && !result.dnf && !teammateResult.dnf) {
        if (result.position < teammateResult.position) {
          moodEvents.push({ type: 'teammate-slower' })
        } else if (result.position > teammateResult.position) {
          moodEvents.push({ type: 'teammate-faster' })
        }
      }
    }

    if (moodEvents.length === 0) return driver
    return { ...driver, mood: updateMood(driver.mood, moodEvents) }
  })

  // 3. Update constructor standings. Same idempotency guard as drivers: a
  //    team already processed for `currentRound` keeps its prior snapshots
  //    and seasonForm — points reflect driver totals but position/form/
  //    snapshots only write once per round.
  let updatedTeams = teams.map(team => {
    const teamDrivers = updatedDrivers.filter(d => d.teamId === team.id && !d.isReserve)
    const constructorPoints = teamDrivers.reduce((sum, d) => sum + d.seasonStats.points, 0)
    const alreadyProcessed = team.lastProcessedRound >= currentRound
    return {
      ...team,
      constructorPoints,
      previousConstructorPosition: alreadyProcessed
        ? team.previousConstructorPosition
        : team.constructorPosition,
      previousMorale: alreadyProcessed ? team.previousMorale : team.morale,
    }
  })

  // Sort and assign positions
  const sorted = [...updatedTeams].sort((a, b) => b.constructorPoints - a.constructorPoints)
  updatedTeams = updatedTeams.map(team => {
    const pos = sorted.findIndex(t => t.id === team.id) + 1
    if (team.lastProcessedRound >= currentRound) {
      return { ...team, constructorPosition: pos }
    }
    // Snapshot OVR alongside constructor position — same idempotency guard
    // keeps the sparkline free of duplicate entries on re-runs.
    const currentOvr = calculateOverallRating(team.car)
    return {
      ...team,
      constructorPosition: pos,
      seasonForm: pushForm(team.seasonForm, pos),
      ovrHistory: pushOvrSample(team.ovrHistory, currentOvr),
      lastProcessedRound: currentRound,
    }
  })

  // 4. Update finance — per-race operational spend
  const updatedFinance: Record<string, FinanceState> = {}
  for (const [teamId, fs] of Object.entries(finance)) {
    let budget = fs.budget
    // Per-race operational cost: ~$2.5M for operations, ~$1M for travel
    budget = recordSpend(budget, 'Operations', 2_500_000)

    // Update prestige for player team
    const team = updatedTeams.find(t => t.id === teamId)
    const teamDrivers = updatedDrivers.filter(d => d.teamId === teamId && !d.isReserve)
    const recentWins = teamDrivers.reduce((sum, d) => sum + d.seasonStats.wins, 0)
    const marketAvg = teamDrivers.length > 0
      ? teamDrivers.reduce((sum, d) => sum + d.attributes.marketability, 0) / teamDrivers.length
      : 50

    const prestigeScore = calculatePrestigeScore({
      constructorPosition: team?.constructorPosition ?? 11,
      recentWins,
      driverMarketabilityAvg: marketAvg,
      mediaPositiveEvents: 0,
      mediaNegativeEvents: 0,
    })

    updatedFinance[teamId] = {
      ...fs,
      budget,
      prestigeScore,
      prestige: scoreToRating(prestigeScore),
      prizeMoneyEstimate: estimatePrizeMoney(team?.constructorPosition ?? 11),
    }
  }

  // 5. Generate narrative events
  const recentResults = results.map(r => ({
    driverId: r.driverId,
    position: r.position,
    dnf: r.dnf,
  }))

  const ctx: GameContext = {
    currentRound,
    playerTeamId,
    drivers: updatedDrivers,
    teams: updatedTeams,
    finance: updatedFinance,
    recentResults,
  }

  // Resolve expired events
  const { resolved, consequences: expiredConsequences } = resolveExpiredEvents(narrativeEvents, currentRound)

  // Generate new events
  const { newEvents, updatedCooldowns } = generateEvents(ctx, resolved, eventCooldowns, rng)
  const allEvents = [...resolved.filter(e => !e.resolved || e.triggeredAtRound >= currentRound - 3), ...newEvents]

  return {
    teams: updatedTeams,
    drivers: updatedDrivers,
    finance: updatedFinance,
    narrativeEvents: allEvents,
    eventCooldowns: updatedCooldowns,
  }
}

function estimatePrizeMoney(position: number): number {
  const baseShare = 50_000_000
  const performancePrize: Record<number, number> = {
    1: 80_000_000, 2: 65_000_000, 3: 55_000_000, 4: 48_000_000, 5: 42_000_000,
    6: 38_000_000, 7: 34_000_000, 8: 30_000_000, 9: 26_000_000, 10: 22_000_000, 11: 18_000_000,
  }
  return baseShare + (performancePrize[position] ?? 15_000_000)
}
