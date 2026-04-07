import type { Team } from '@/types/team'
import type { Driver } from '@/types/driver'
import type { FinanceState } from '@/types/finance'
import { applyAging } from '@/engine/drivers/aging'
import { calculatePrizeMoney, checkCapBreach } from '@/engine/finance/budget-engine'
import { applySeasonRegulations } from '@/engine/regulations/regulation-engine'
import { RND_TREE } from '@/data/rnd-tree'

export interface SeasonEndResult {
  teams: Team[]
  drivers: Driver[]
  finance: Record<string, FinanceState>
  prizeMoney: Record<string, number>
  capBreaches: Record<string, { breached: boolean; penaltyTier: string | null; pointsDeduction: number }>
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
): SeasonEndResult {
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

    // Check contract expiration
    const contractExpired = driver.contract && driver.contract.termEndSeason <= currentSeason
    const contract = contractExpired ? null : driver.contract

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
        dnfs: 0,
        penalties: 0,
        bestFinish: 0,
        averageFinish: 0,
      },
    }
  })

  // 3. Reset finances for new season
  const updatedFinance: Record<string, FinanceState> = {}
  for (const [teamId, fs] of Object.entries(finance)) {
    const prize = prizeMoney[teamId] ?? 0
    updatedFinance[teamId] = {
      ...fs,
      budget: {
        ...fs.budget,
        totalSpent: 0,
        categories: fs.budget.categories.map(cat => ({ ...cat, spent: 0 })),
        penaltyRisk: false,
        projectedEndOfSeason: 0,
      },
      prizeMoneyEstimate: prize,
      // Sponsors carry over (would be checked/removed in full implementation)
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
    // Reset constructor standings
    constructorPoints: 0,
    constructorPosition: 0,
  }))

  // 5. Apply next season's regulation changes
  const nextSeason = currentSeason + 1
  const regResult = applySeasonRegulations(updatedTeams, updatedFinance, nextSeason)
  updatedTeams = regResult.teams
  const finalFinance = regResult.finance

  return {
    teams: updatedTeams,
    drivers: updatedDrivers,
    finance: finalFinance,
    prizeMoney,
    capBreaches,
  }
}
