export type PrestigeRating = 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F'
export type SponsorTier = 'title' | 'major' | 'minor'

export interface SponsorKPI {
  description: string
  target: number
  current: number
  met: boolean
}

export interface Sponsor {
  id: string
  name: string
  tier: SponsorTier
  annualValue: number
  bonusValue: number
  kpis: SponsorKPI[]
  satisfaction: number // 0-100
  contractEndSeason: number
  minimumPrestige: PrestigeRating
  /**
   * Season in which this sponsor last banked its performance bonus, or null if
   * never. Gates `FinanceState.bankedBonuses` accrual to once per season per
   * sponsor (re-arms when the season advances), so a met→unmet→met KPI re-flip
   * cannot double-bank. Persisted (schema v14).
   */
  bonusPaidSeason: number | null
}

export interface BudgetCategory {
  name: string
  allocated: number
  spent: number
}

export interface Budget {
  cap: number // $215M
  totalSpent: number
  categories: BudgetCategory[]
  projectedEndOfSeason: number
  penaltyRisk: boolean
}

export interface FinanceState {
  budget: Budget
  sponsors: Sponsor[]
  prestige: PrestigeRating
  prestigeScore: number // 0-100 maps to letter grade
  prizeMoneyEstimate: number
  marketingBudget: number
  /**
   * Career-cumulative cash from sponsor KPI performance bonuses. Each player
   * sponsor banks its bonusValue once per season (the first round all its KPIs
   * are met), gated by Sponsor.bonusPaidSeason so a met→unmet→met re-flip cannot
   * double-bank; the latch re-arms each new season. Never reset — a lifetime
   * total. Player-only: AI sponsors are never evaluated, so it stays 0.
   */
  bankedBonuses: number
}
