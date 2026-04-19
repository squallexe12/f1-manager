import type { DepartmentHead } from './team'
import type { TireCompound } from './race'

/**
 * A machine-dispatchable recommendation surfaced to the player during the
 * management phase. Generated once per entry by the orchestrator via
 * `generateRecommendations()` (pure, seeded). Shown in the Paddock, Factory,
 * and pre-race Strategy surfaces.
 *
 * The `action` field is a colon-delimited intent. When `applicable` is true,
 * the store action `applyRecommendation(id)` routes on the action prefix to
 * the relevant engine path.
 */
export interface Recommendation {
  id: string
  role: DepartmentHead['role']
  department: string
  action: string
  description: string
  applicable: boolean
  status: 'active' | 'applied' | 'dismissed'
  generatedAtRound: number
}

export interface StagedStrategy {
  stops: { lap: number; compound: TireCompound }[]
  startCompound: TireCompound
}

export type StagedStrategies = Record<string, StagedStrategy>
