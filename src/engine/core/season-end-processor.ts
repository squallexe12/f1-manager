import type { Team } from '@/types/team'
import type { Driver } from '@/types/driver'
import type { FinanceState } from '@/types/finance'
import type { PoachingAttempt } from '@/types/staff'
import { applyAging } from '@/engine/drivers/aging'
import { calculatePrizeMoney, checkCapBreach } from '@/engine/finance/budget-engine'
import { applySeasonRegulations } from '@/engine/regulations/regulation-engine'
import { RND_TREE } from '@/data/rnd-tree'
import { applySeasonEndCareerDeltas } from '@/engine/drivers/career-stats'
import { derivePulse, type PulseContext } from '@/engine/drivers/pulse'
import { computeScoutSignal } from '@/engine/drivers/scout-signal'
import { SPONSORS } from '@/data/sponsors'
import { isSponsorAtRisk, getAvailableSponsors, signSponsor } from '@/engine/finance/sponsor-engine'

export interface SeasonEndResult {
  teams: Team[]
  drivers: Driver[]
  finance: Record<string, FinanceState>
  prizeMoney: Record<string, number>
  capBreaches: Record<string, { breached: boolean; penaltyTier: string | null; pointsDeduction: number }>
  /**
   * Tier B v2 (IP-B4) — fresh poaching-attempts array for the new season.
   * Always `[]`: matched/declined/expired attempts are resolved during
   * `processSeasonEnd`, so the new season starts with no carry-over.
   * Caller (`processSeasonEndPhase`) replaces `world.poachingAttempts`.
   */
  poachingAttempts: PoachingAttempt[]
}

/**
 * Tier B v2 (IP-B4) — apply the consequences of declined poaching attempts:
 * staff the player declined to retain leaves the team at season end.
 * Returns the team list with the declined-target staff removed.
 *
 * Pure function. Matched and expired attempts are also dropped from the
 * returned `poachingAttempts` regardless — the array always returns `[]`.
 */
function applyDeclinedPoaching(
  teams: Team[],
  playerTeamId: string | undefined,
  attempts: PoachingAttempt[],
): Team[] {
  if (!playerTeamId) return teams
  const declined = attempts.filter((a) => a.status === 'declined')
  if (declined.length === 0) return teams
  return teams.map((t) => {
    if (t.id !== playerTeamId) return t
    let nextChief = t.pitCrewChief
    let nextMembers = t.pitCrewMembers
    for (const attempt of declined) {
      if (nextChief && nextChief.id === attempt.targetStaffId) {
        nextChief = null
      }
      nextMembers = nextMembers.filter((m) => m.id !== attempt.targetStaffId)
    }
    return { ...t, pitCrewChief: nextChief, pitCrewMembers: nextMembers }
  })
}

/**
 * Process everything at the end of a season:
 * - Prize money distribution
 * - Budget cap breach checks
 * - Driver aging
 * - Contract expiration checks
 * - R&D reset for new season
 * - Regulation changes for next season
 * - Wind tunnel / CFD reset
 */
export function processSeasonEnd(
  teams: Team[],
  drivers: Driver[],
  finance: Record<string, FinanceState>,
  currentSeason: number,
  poachingAttempts: PoachingAttempt[] = [],
  playerTeamId?: string,
): SeasonEndResult {
  // Tier B v2 (IP-B4) — apply declined poaching consequences before any
  // other team transformations so the staff exodus is reflected in
  // downstream resets.
  teams = applyDeclinedPoaching(teams, playerTeamId, poachingAttempts)

  const prizeMoney: Record<string, number> = {}
  const capBreaches: Record<string, { breached: boolean; penaltyTier: string | null; pointsDeduction: number }> = {}

  // 1. Calculate prize money and check cap breaches
  let updatedTeams = teams.map(team => {
    const prize = calculatePrizeMoney(team.constructorPosition)
    prizeMoney[team.id] = prize

    const breach = checkCapBreach(finance[team.id]?.budget ?? { totalSpent: 0, cap: 215_000_000 } as any)
    capBreaches[team.id] = {
      breached: breach.breached,
      penaltyTier: breach.penaltyTier,
      pointsDeduction: breach.constructorPointsDeduction,
    }

    // Apply cap breach penalties
    if (breach.breached) {
      return {
        ...team,
        constructorPoints: Math.max(0, team.constructorPoints - breach.constructorPointsDeduction),
        windTunnelHoursLimit: Math.max(0, team.windTunnelHoursLimit * (1 - breach.windTunnelReduction / 100)),
      }
    }
    return team
  })

  // 2. Age all drivers and handle contracts
  let updatedDrivers = drivers.map(driver => {
    const newAttributes = applyAging(driver)
    const newAge = driver.age + 1

    // Contract expiration. `termEndSeason` is RELATIVE (seasons remaining;
    // see src/types/driver.ts): 1 means this is the final season, so the
    // contract expires now. Survivors decrement by one and persist as a new
    // object (engine purity — never mutate the input contract).
    let contract = driver.contract
    if (contract) {
      contract = contract.termEndSeason <= 1
        ? null
        : { ...contract, termEndSeason: contract.termEndSeason - 1 }
    }

    return {
      ...driver,
      attributes: newAttributes,
      age: newAge,
      contract,
      // Reset season stats
      seasonStats: {
        points: 0,
        wins: 0,
        podiums: 0,
        poles: 0,
        dnfs: 0,
        penalties: 0,
        bestFinish: 0,
        averageFinish: 0,
        lastProcessedRound: 0,
      },
      // Reset rolling form window per season; continuity across seasons
      // would mislead the Paddock sparkline.
      form: [] as number[],
      lastRaceResult: null as number | null,
    }
  })

  // 3. Reset finances for new season
  const nextSeason = currentSeason + 1
  const updatedFinance: Record<string, FinanceState> = {}
  for (const [teamId, fs] of Object.entries(finance)) {
    const prize = prizeMoney[teamId] ?? 0

    // Sponsor lifecycle — player team only: depart at-risk (satisfaction < 30)
    // or contract-expired sponsors, then auto-backfill open slots from the
    // available pool (prestige-gated, deterministic by value then id).
    let sponsors = fs.sponsors
    if (playerTeamId && teamId === playerTeamId) {
      const originalCount = fs.sponsors.length
      const retained = fs.sponsors.filter(
        s => !isSponsorAtRisk(s) && s.contractEndSeason > currentSeason,
      )
      // Exclude ALL original ids (retained + departed) so a just-departed
      // unhappy sponsor cannot immediately re-sign this same season.
      const existingIds = fs.sponsors.map(s => s.id)
      const available = getAvailableSponsors(SPONSORS, fs.prestige, existingIds)
        .slice()
        .sort((a, b) => b.annualValue - a.annualValue || a.id.localeCompare(b.id))
      const needed = Math.max(0, originalCount - retained.length)
      const backfill = available.slice(0, needed).map(t => signSponsor(t, nextSeason))
      sponsors = [...retained, ...backfill]
    }

    updatedFinance[teamId] = {
      ...fs,
      budget: {
        ...fs.budget,
        totalSpent: 0,
        categories: fs.budget.categories.map(cat => ({ ...cat, spent: 0 })),
        penaltyRisk: false,
        projectedEndOfSeason: 0,
      },
      sponsors,
      prizeMoneyEstimate: prize,
    }
  }

  // 4. Reset R&D for new season (keep completed upgrades, reset progress on in-progress)
  updatedTeams = updatedTeams.map(team => ({
    ...team,
    rndUpgrades: team.rndUpgrades.map(upgrade => {
      if (upgrade.status === 'complete') return upgrade
      // Reset in-progress back to available
      if (upgrade.status === 'in-progress' || upgrade.status === 'queued') {
        return { ...upgrade, status: 'available' as const, progress: 0 }
      }
      return upgrade
    }),
    // Reset aero testing allocation
    windTunnelHoursUsed: 0,
    cfdRunsUsed: 0,
    // Reset constructor standings + Paddock hero trend snapshots.
    constructorPoints: 0,
    constructorPosition: 0,
    previousConstructorPosition: 0,
    previousMorale: team.morale,
    seasonForm: [],
    lastProcessedRound: 0,
    // Season-boundary reset: trend history and last-upgrade marker start
    // fresh for the new championship. Factory card sparkline renders blank
    // for R01 until the first post-race write.
    ovrHistory: [],
    lastUpgradeRound: 0,
    // Box 1 (Phase 1) buffers also reset: fastest-lap log starts fresh for
    // the new championship; failure-event log is per-season.
    fastestLapHistory: [],
    failureEvents: [],
    // Phase 2 (Box 2) buffers also reset per season: penalty counter starts
    // at zero, queued swaps are dropped (a season boundary discards any
    // unresolved election from the prior championship).
    penaltiesTaken: 0,
    pendingComponentSwaps: [],
    // Phase 3 (Box 3) buffers reset per season: the CDT booking ledger
    // and recent-upgrade-outcome buffer both start fresh for the new
    // championship. Correlation Δ falls back to its hash heuristic until
    // the new season's first delivery resolves.
    aeroBookings: [],
    upgradeOutcomes: [],
  }))

  // 5. Apply next season's regulation changes
  const regResult = applySeasonRegulations(updatedTeams, updatedFinance, nextSeason)
  updatedTeams = regResult.teams
  const finalFinance = regResult.finance

  // 6. Award world titles based on final Drivers' Championship standings.
  const sortedByPoints = [...updatedDrivers]
    .filter(d => !d.isReserve && d.teamId !== null)
    .sort((a, b) => b.seasonStats.points - a.seasonStats.points)
  updatedDrivers = updatedDrivers.map(d => {
    const finalStanding = sortedByPoints.findIndex(s => s.id === d.id) + 1 || updatedDrivers.length
    return applySeasonEndCareerDeltas(d, finalStanding)
  })

  // 7. Recompute pulse + scoutSignal for the new season opener.
  const pulseCtx: PulseContext = {
    championshipPositionByDriverId: {}, // new season — no positions yet
    championshipGapByDriverId: {},
    totalDriversInChampionship: updatedDrivers.length,
    currentRound: 0,
    currentSeason: nextSeason,
  }
  updatedDrivers = updatedDrivers.map(d => ({
    ...d,
    pulse: derivePulse(d, pulseCtx),
    scoutSignal: computeScoutSignal(d),
  }))

  return {
    teams: updatedTeams,
    drivers: updatedDrivers,
    finance: finalFinance,
    prizeMoney,
    capBreaches,
    // Tier B v2 (IP-B4) — fresh slate. Matched/declined/expired all resolved.
    poachingAttempts: [],
  }
}
