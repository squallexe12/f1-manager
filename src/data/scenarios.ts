import type { ScenarioType } from '@/types/game'
import type { CarPerformance } from '@/types/team'
import type { PrestigeRating } from '@/types/finance'

export interface Scenario {
  id: ScenarioType
  name: string
  description: string
  budgetModifier: number       // multiplier on starting budget (1.0 = default)
  carPerformanceModifier: number // added to all car stats
  moraleModifier: number       // added to base morale
  prestigeOverride: PrestigeRating | null
  availableTeams: string[] | 'all'
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'golden-era',
    name: 'Golden Era',
    description: 'You inherit a championship-contending team at its peak. Maintain dominance while rivals close in.',
    budgetModifier: 1.1,
    carPerformanceModifier: 3,
    moraleModifier: 10,
    prestigeOverride: 'A+',
    availableTeams: ['mclaren', 'red-bull', 'ferrari', 'mercedes'],
  },
  {
    id: 'rebuild',
    name: 'The Rebuild',
    description: 'A once-great team has fallen. Outdated facilities, unhappy sponsors, but a proud legacy. Bring them back.',
    budgetModifier: 0.85,
    carPerformanceModifier: -5,
    moraleModifier: -10,
    prestigeOverride: 'C+',
    availableTeams: ['williams', 'alpine', 'aston-martin'],
  },
  {
    id: 'newcomer',
    name: 'New Entrant',
    description: 'A brand-new constructor entering F1. Everything starts from scratch — no history, no rivals, no excuses.',
    budgetModifier: 0.75,
    carPerformanceModifier: -10,
    moraleModifier: 5,
    prestigeOverride: 'D',
    availableTeams: ['cadillac', 'audi'],
  },
  {
    id: 'crisis',
    name: 'Crisis Management',
    description: 'Budget cap breach, driver revolt, sponsor exodus. One season to save the team from collapse.',
    budgetModifier: 0.65,
    carPerformanceModifier: -3,
    moraleModifier: -20,
    prestigeOverride: 'F',
    availableTeams: 'all',
  },
]
