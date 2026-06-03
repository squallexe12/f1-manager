import type { Team } from '@/types/team'
import type { Driver } from '@/types/driver'
import type { FinanceState } from '@/types/finance'
import type { NarrativeEvent, EventConsequence } from '@/types/narrative'
import type { PRNG } from '@/engine/core/prng'
import type { AppliedPenalty } from '@/types/race'
import { updateMood, type MoodEvent } from '@/engine/drivers/mood-system'
import { pushForm, pushOvrSample, pushFastestLap, FORM_DNF } from '@/engine/drivers/form-history'
import { calculateOverallRating } from '@/engine/engineering/car-performance'
import { tickComponentWear } from '@/engine/engineering/component-strategy'
import { measureUpgradeOutcome } from '@/engine/engineering/aero-budget'
import { recordSpend } from '@/engine/finance/budget-engine'
import { calculatePrestigeScore, scoreToRating } from '@/engine/finance/prestige'
import { generateEvents, resolveExpiredEvents, type GameContext } from '@/engine/narrative/event-generator'
import { expirePenaltyPoints, sumActivePoints, wipeContributingPoints } from '@/engine/drivers/penalty-points'
import { DEFAULT_PENALTY_CALIBRATION } from '@/data/penalty-calibration'
import { applyRaceCareerDeltas } from '@/engine/drivers/career-stats'
import { derivePulse, type PulseContext } from '@/engine/drivers/pulse'
import { computeScoutSignal } from '@/engine/drivers/scout-signal'
import { computeChampionshipSummary } from '@/engine/drivers/championship-summary'
import { SPONSORS } from '@/data/sponsors'
import { evaluateSponsorSeason, type SponsorSeasonContext } from '@/engine/finance/sponsor-kpi'
import type { Sponsor } from '@/types/finance'

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
  totalRounds: number,
  rng: PRNG,
): PostRaceUpdate {
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

    // DNF drivers now reach the processor (classified, dnf:true). Guard all
    // position-based credit so attrition can't grant phantom points/podiums.
    const points = result.dnf ? 0 : (pointsTable[result.position] ?? 0)
    const fastestLapBonus = !result.dnf && result.fastestLap && result.position <= 10 ? 1 : 0

    const stats = { ...driver.seasonStats }
    stats.points += points + fastestLapBonus
    if (!result.dnf && result.position === 1) stats.wins++
    if (!result.dnf && result.position <= 3) stats.podiums++
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
    const updatedFromRace = {
      ...driver,
      seasonStats: stats,
      form: pushForm(driver.form, formSample),
      lastRaceResult: result.dnf ? null : result.position,
      penaltyPoints,
      warningsThisSeason,
      nextRaceGridDrop,
      banUntilRound,
    }
    return applyRaceCareerDeltas(updatedFromRace, result.position, result.dnf)
  })

  // 2. Update driver moods
  updatedDrivers = updatedDrivers.map(driver => {
    const result = results.find(r => r.driverId === driver.id)
    if (!result) return driver

    // A DNF gets only the dnf mood event — a low attrition-classified position
    // must never read as a "points-finish"/"podium"/"race-win".
    const moodEvents: MoodEvent[] = []
    if (result.dnf) {
      moodEvents.push({ type: 'dnf' })
    } else if (result.position === 1) {
      moodEvents.push({ type: 'race-win' })
    } else if (result.position <= 3) {
      moodEvents.push({ type: 'podium' })
    } else if (result.position <= 10) {
      moodEvents.push({ type: 'points-finish' })
    }

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
    // Box 1 (Phase 1): append a fastestLapHistory entry to the team whose
    // driver held the absolute race-wide fastest lap. Other teams retain
    // their existing buffer untouched. `team.driverIds` is `[string, string]`;
    // `.includes(string)` works without a cast.
    const teamHadFastestLap =
      fastestLap !== null && team.driverIds.includes(fastestLap.driverId)
    const nextFastestLapHistory = teamHadFastestLap
      ? pushFastestLap(team.fastestLapHistory, { round: currentRound, lapMs: fastestLap!.time })
      : team.fastestLapHistory
    const worn = tickComponentWear(team)
    // Phase 3 (Box 3): for the player team, measure each upgrade outcome
    // whose first post-delivery race has just completed. AI teams skip this
    // — their outcomes are persisted but not surfaced anywhere, and pruning
    // them isn't free.
    const measured = team.id === playerTeamId
      ? measureUpgradeOutcome(team, currentRound)
      : team
    return {
      ...team,
      constructorPosition: pos,
      seasonForm: pushForm(team.seasonForm, pos),
      ovrHistory: pushOvrSample(team.ovrHistory, currentOvr),
      fastestLapHistory: nextFastestLapHistory,
      components: worn.components,
      upgradeOutcomes: measured.upgradeOutcomes,
      lastProcessedRound: currentRound,
    }
  })

  // 4. Update finance — per-race operational spend
  const updatedFinance: Record<string, FinanceState> = {}
  const sponsorNotes: NarrativeEvent[] = []
  for (const [teamId, fs] of Object.entries(finance)) {
    let budget = fs.budget
    // Per-race operational cost (~$2.5M). Guarded by the same idempotency rule
    // as the driver-stats (`:93`) and team-snapshot (`:215`) blocks: a team
    // already credited for `currentRound` must not be debited again on a
    // double-fire of submitRaceResults. `teams` is the pre-update input, so its
    // lastProcessedRound still reflects prior rounds (updatedTeams is stamped to
    // currentRound above and would defeat the guard).
    const inputTeam = teams.find(t => t.id === teamId)
    const alreadyProcessed = (inputTeam?.lastProcessedRound ?? -1) >= currentRound
    if (!alreadyProcessed) {
      budget = recordSpend(budget, 'Operations', 2_500_000)
    }

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

    // Sponsor KPI evaluation — player team only. AI sponsors are never
    // surfaced; mirrors the player-only measureUpgradeOutcome precedent.
    let sponsors = fs.sponsors
    // Cash banked this round = bonusValue of every player sponsor whose KPIs are
    // fully met and that has NOT already banked its bonus this season. `met` is
    // a hard threshold test that genuinely oscillates round-to-round (e.g.
    // constructorPosition slipping past target), so a rising-edge alone would
    // double-bank on a met→unmet→met re-flip. The per-season `bonusPaidSeason`
    // latch banks each sponsor's annual bonus exactly once per season (re-arms
    // next season) and is also immune to a same-round double-fire of
    // submitRaceResults (the latch is already set on the second pass).
    let bankedThisRound = 0
    if (teamId === playerTeamId) {
      const ctx = buildSponsorContext(
        team?.constructorPosition ?? 11, teamDrivers, budget, currentRound, totalRounds,
      )
      sponsors = fs.sponsors.map(prior => {
        const next = evaluateSponsorSeason(prior, metricsForSponsor(prior.id), ctx)
        const nowMet = next.kpis.length > 0 && next.kpis.every(k => k.met)
        const alreadyPaidThisSeason = prior.bonusPaidSeason === currentSeason
        if (nowMet && next.bonusValue > 0 && !alreadyPaidThisSeason) {
          sponsorNotes.push(buildSponsorBonusNote(next, currentRound))
          bankedThisRound += next.bonusValue
          return { ...next, bonusPaidSeason: currentSeason }
        }
        return next
      })
    }

    updatedFinance[teamId] = {
      ...fs,
      budget,
      sponsors,
      bankedBonuses: fs.bankedBonuses + bankedThisRound,
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
  const allEvents = [
    ...resolved.filter(e => !e.resolved || e.triggeredAtRound >= currentRound - 3),
    ...newEvents,
    ...sponsorNotes,
  ]

  // Recompute per-driver narrative pulse and scout signal after all
  // mutations have settled. Both are pure derivations from observable state;
  // running them last ensures they reflect the final post-race world.
  const championship = computeChampionshipSummary(updatedDrivers)
  const pulseCtx: PulseContext = {
    championshipPositionByDriverId: championship.positionById,
    championshipGapByDriverId: championship.gapById,
    totalDriversInChampionship: updatedDrivers.length,
    currentRound,
    currentSeason,
  }
  updatedDrivers = updatedDrivers.map(driver => ({
    ...driver,
    pulse: derivePulse(driver, pulseCtx),
    scoutSignal: computeScoutSignal(driver),
  }))

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

/** Per-sponsor metric kinds, index-aligned to the static template KPIs. */
function metricsForSponsor(sponsorId: string): (import('@/data/sponsors').SponsorMetricKind | undefined)[] {
  const template = SPONSORS.find(t => t.id === sponsorId)
  return template ? template.kpiTemplates.map(k => k.metric) : []
}

function buildSponsorContext(
  constructorPosition: number,
  drivers: Driver[],
  budget: { totalSpent: number; cap: number },
  currentRound: number,
  totalRounds: number,
): SponsorSeasonContext {
  const teamPoints = drivers.reduce((s, d) => s + d.seasonStats.points, 0)
  const teamWins = drivers.reduce((s, d) => s + d.seasonStats.wins, 0)
  const teamPodiums = drivers.reduce((s, d) => s + d.seasonStats.podiums, 0)
  const teamDnfs = drivers.reduce((s, d) => s + d.seasonStats.dnfs, 0)
  const driverMarketabilityAvg = drivers.length
    ? drivers.reduce((s, d) => s + d.attributes.marketability, 0) / drivers.length
    : 0
  const minDriverRaceFinishes = drivers.length
    ? Math.min(...drivers.map(d => currentRound - d.seasonStats.dnfs))
    : 0
  const bothDriversScored: 0 | 1 =
    drivers.length >= 2 && drivers.every(d => d.seasonStats.points > 0) ? 1 : 0
  return {
    constructorPosition,
    teamPoints, teamWins, teamPodiums, teamDnfs,
    driverMarketabilityAvg, minDriverRaceFinishes, bothDriversScored,
    capBreached: budget.totalSpent > budget.cap,
    currentRound, totalRounds,
  }
}

function buildSponsorBonusNote(sponsor: Sponsor, currentRound: number): NarrativeEvent {
  const bonusM = (sponsor.bonusValue / 1_000_000).toFixed(1)
  return {
    id: `sponsor-bonus-${sponsor.id}-r${currentRound}`,
    thread: 'sponsor-drama',
    severity: 'news',
    headline: `${sponsor.name} bonus secured`,
    body: `All KPI targets met for ${sponsor.name}. The $${bonusM}M performance bonus is unlocked.`,
    options: null,
    defaultOutcome: null,
    arcId: null,
    triggeredAtRound: currentRound,
    expiresAtRound: currentRound + 3,
    resolved: false,
  }
}
