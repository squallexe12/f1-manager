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
}
