import type { ScenarioType } from '@/types/game'
import type { CarPerformance } from '@/types/team'
import type { PrestigeRating } from '@/types/finance'

export interface BoardExpectation {
  positionDelta: number   // shift on the tier-derived target position (− = stricter)
  pointsFactor: number    // multiplier on the position's baseline points target
  toneLabel: string       // season framing shown on the board card
}

export interface Scenario {
  id: ScenarioType
  name: string
  description: string
  budgetModifier: number       // multiplier on starting budget (1.0 = default)
  carPerformanceModifier: number // added to all car stats
  moraleModifier: number       // added to base morale
  prestigeOverride: PrestigeRating | null
  availableTeams: string[] | 'all'
  boardExpectation: BoardExpectation
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
    boardExpectation: { positionDelta: -1, pointsFactor: 1.10, toneLabel: 'Title or bust' },
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
    boardExpectation: { positionDelta: 1, pointsFactor: 0.90, toneLabel: 'Climb the order' },
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
    boardExpectation: { positionDelta: 2, pointsFactor: 0.80, toneLabel: 'Find your feet' },
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
    boardExpectation: { positionDelta: 2, pointsFactor: 0.75, toneLabel: 'Survive the season' },
  },
]
