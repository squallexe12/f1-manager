import type { Team } from '@/types/team'
import type { Driver } from '@/types/driver'
import type { FinanceState } from '@/types/finance'
import type { NarrativeEvent, EventConsequence } from '@/types/narrative'
import type { PRNG } from '@/engine/core/prng'
import type { AppliedPenalty } from '@/types/race'
import { updateMood, type MoodEvent } from '@/engine/drivers/mood-system'
import { pushForm, pushOvrSample, FORM_DNF } from '@/engine/drivers/form-history'
import { calculateOverallRating } from '@/engine/engineering/car-performance'
import { recordSpend } from '@/engine/finance/budget-engine'
import { calculatePrestigeScore, scoreToRating } from '@/engine/finance/prestige'
import { generateEvents, resolveExpiredEvents, type GameContext } from '@/engine/narrative/event-generator'
import { expirePenaltyPoints, sumActivePoints, wipeContributingPoints } from '@/engine/drivers/penalty-points'
import { DEFAULT_PENALTY_CALIBRATION } from '@/data/penalty-calibration'

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
  /**
   * Penalties applied to this driver during the race, sourced from the
   * worker's appliedPenaltiesByDriver map and joined per-driver by the
   * main thread before submitRaceResults is called. Empty array if no
   * penalties were applied. Default to [] when omitted by callers built
   * before Tier A.
   */
  appliedPenalties?: AppliedPenalty[]
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
  fastestLap: { driverId: string; time: number } | null,
  isSprint: boolean,
  currentRound: number,
  currentSeason: number,
  playerTeamId: string,
  rng: PRNG,
): PostRaceUpdate {
  // `fastestLap` is the absolute race-wide fastest lap from the worker
  // (`runtime.fastestLap`). Plumbed in for Box 1 fastestLapHistory append in
  // Task 7. Phase 1 Task 6 — mechanical plumbing only, no behavior change.
  void fastestLap
  const pointsTable = isSprint ? SPRINT_POINTS : RACE_POINTS

  // Clear any ban whose suspended round equals currentRound — that race has
  // now been served.  Operate on the input drivers before any further mutation.
  const activeDrivers: Driver[] = drivers.map((d) =>
    d.banUntilRound === currentRound ? { ...d, banUntilRound: null } : d,
  )

  // 1. Update driver season stats and points.
  //    Idempotency guard (see SeasonStats.lastProcessedRound) skips drivers
  //    whose stats were already credited for `currentRound` — defends against
  //    any double-fire of submitRaceResults.
  let updatedDrivers = activeDrivers.map(driver => {
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

    // Fold appliedPenalties into the driver's persistent state.
    let penaltyPoints = [...driver.penaltyPoints]
    let warningsThisSeason = driver.warningsThisSeason
    let nextRaceGridDrop = driver.nextRaceGridDrop
    let banUntilRound = driver.banUntilRound
    const applied = result.appliedPenalties ?? []
    for (const ap of applied) {
      if (ap.penaltyPointsIssued > 0) {
        penaltyPoints.push({
          points: ap.penaltyPointsIssued,
          issuedSeason: currentSeason,
          issuedRound: currentRound,
          offenceType: ap.offenceType,
          raceId: `r${currentRound}`,
        })
      }
      if (ap.warningCounted) warningsThisSeason += 1
      if (ap.timePenaltySeconds > 0) stats.penalties += 1
    }
    // Expire stale entries (22-round rolling window)
    penaltyPoints = expirePenaltyPoints(
      penaltyPoints,
      currentSeason,
      currentRound,
      DEFAULT_PENALTY_CALIBRATION.rollingWindowRounds,
    )
    // Ban check: crossing banThreshold triggers suspension for banDurationRounds
    if (sumActivePoints(penaltyPoints) >= DEFAULT_PENALTY_CALIBRATION.banThreshold) {
      banUntilRound = currentRound + DEFAULT_PENALTY_CALIBRATION.banDurationRounds
      penaltyPoints = wipeContributingPoints(penaltyPoints, DEFAULT_PENALTY_CALIBRATION.banThreshold)
    }
    // Warning threshold: 5 warnings → 10-place grid drop next race, reset counter
    if (warningsThisSeason >= DEFAULT_PENALTY_CALIBRATION.warningThreshold) {
      nextRaceGridDrop = Math.max(nextRaceGridDrop, DEFAULT_PENALTY_CALIBRATION.warningGridDrop)
      warningsThisSeason = 0
    }

    const formSample = result.dnf ? FORM_DNF : result.position
    return {
      ...driver,
      seasonStats: stats,
      form: pushForm(driver.form, formSample),
      lastRaceResult: result.dnf ? null : result.position,
      penaltyPoints,
      warningsThisSeason,
      nextRaceGridDrop,
      banUntilRound,
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
