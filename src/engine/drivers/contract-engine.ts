import type { Driver, Contract } from '@/types/driver'
import type { Team } from '@/types/team'

export interface ContractOffer {
  salary: number
  termLength: number
  performanceBonuses: { condition: string; value: number }[]
  releaseClause: number | null
}

export interface ContractEvaluation {
  accepted: boolean
  satisfaction: number // 0-100: how happy the driver is with the offer
  counterOffer: ContractOffer | null
}

/**
 * Calculate a driver's market value based on attributes + performance.
 */
export function estimateMarketValue(driver: Driver): number {
  const attrAvg = (
    driver.attributes.pace * 1.5 +
    driver.attributes.racecraft * 1.2 +
    driver.attributes.experience * 0.8 +
    driver.attributes.marketability * 1.0
  ) / 4.5

  // Base salary curve: 50 attr → $2M, 80 attr → $15M, 95+ attr → $40M+
  const baseSalary = Math.pow(attrAvg / 100, 3) * 60_000_000

  // Age modifier: young talent premium, veteran discount
  const ageMod = driver.age < 25 ? 1.1 : driver.age > 34 ? 0.7 : 1.0

  return Math.round(baseSalary * ageMod)
}

/**
 * Evaluate whether a driver would accept a contract offer.
 */
export function evaluateOffer(
  driver: Driver,
  offer: ContractOffer,
  team: Team,
): ContractEvaluation {
  const marketValue = estimateMarketValue(driver)
  let satisfaction = 50

  // Salary vs market value
  const salaryRatio = offer.salary / Math.max(1, marketValue)
  satisfaction += (salaryRatio - 1) * 40 // over-market = happy, under = unhappy

  // Team competitiveness (car average)
  const carAvg = (team.car.downforce + team.car.straightSpeed + team.car.reliability +
    team.car.tireManagement + team.car.braking + team.car.cornering) / 6
  satisfaction += (carAvg - 70) * 0.5 // bonus for competitive team

  // Mood influence
  satisfaction += (driver.mood.motivation - 50) * 0.3
  satisfaction -= driver.mood.frustration * 0.2

  // Contract length: drivers prefer 2-year sweet spot
  if (offer.termLength === 2) satisfaction += 5
  if (offer.termLength >= 4) satisfaction -= 5

  satisfaction = Math.max(0, Math.min(100, satisfaction))

  const accepted = satisfaction >= 55

  // Generate counter-offer if not accepted but close
  let counterOffer: ContractOffer | null = null
  if (!accepted && satisfaction >= 35) {
    counterOffer = {
      salary: Math.round(offer.salary * 1.2),
      termLength: Math.min(offer.termLength, 2),
      performanceBonuses: offer.performanceBonuses,
      releaseClause: offer.releaseClause ? Math.round(offer.releaseClause * 0.8) : null,
    }
  }

  return { accepted, satisfaction, counterOffer }
}
