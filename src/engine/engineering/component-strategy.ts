import type { Team, ComponentElement, ComponentAllocation } from '@/types/team'
import type { Driver } from '@/types/driver'
import { getGridPenalty } from './component-lifecycle'

/**
 * Append a power-unit swap election to the team's pending queue. Idempotent
 * on (driverId, element) — re-electing the same swap is a no-op (returns
 * the same team reference unchanged). The first election wins; later
 * elections for the same pair are ignored. Used by the Factory page's
 * Component Strategy sub-section in response to `INTRODUCE NEW` clicks.
 */
export function electComponentSwap(
  team: Team,
  driverId: string,
  element: ComponentElement,
  currentRound: number,
): Team {
  const alreadyQueued = team.pendingComponentSwaps.some(
    (s) => s.driverId === driverId && s.element === element,
  )
  if (alreadyQueued) return team
  return {
    ...team,
    pendingComponentSwaps: [
      ...team.pendingComponentSwaps,
      { driverId, element, electedRound: currentRound },
    ],
  }
}

export interface ApplyPendingSwapsResult {
  team: Team
  gridPenaltyByDriver: Record<string, number>
}

/**
 * Drain the team's queued component swaps. For each swap:
 *  1. Increment the team-shared `components[element].used` counter.
 *  2. If the PRE-increment counter was at-or-over the limit, compute the
 *     grid penalty via `getGridPenalty` (pre-increment semantics: see
 *     component-lifecycle.ts) and ADD it to the named driver's total in
 *     the returned map.
 *  3. Increment `team.penaltiesTaken` once per penalty-incurring swap.
 *
 * After draining, `pendingComponentSwaps` is empty. Returns both the
 * updated team and the per-driver grid-penalty map; the orchestrator
 * folds the map into each driver's `nextRaceGridDrop` (the existing
 * Tier A channel consumed by the strategy page at race start).
 *
 * Pure — does not mutate inputs. The `drivers` parameter is currently
 * unused but reserved so the signature stays stable when a future phase
 * adds per-driver wear tracking. Pass any `Driver[]` (e.g., world.drivers).
 */
export function applyPendingSwaps(
  team: Team,
  _drivers: Driver[],
  _currentRound: number,
): ApplyPendingSwapsResult {
  if (team.pendingComponentSwaps.length === 0) {
    return { team, gridPenaltyByDriver: {} }
  }

  let workingComponents: ComponentAllocation[] = team.components.map((c) => ({ ...c }))
  const gridPenaltyByDriver: Record<string, number> = {}
  let penaltiesIncurred = 0

  for (const swap of team.pendingComponentSwaps) {
    const idx = workingComponents.findIndex((c) => c.element === swap.element)
    if (idx < 0) continue // safety: unknown element
    const preIncrement = workingComponents[idx]
    // PRE-INCREMENT penalty calculation. `getGridPenalty` is contracted to
    // be called BEFORE incrementing — its `used == limit` branch returns
    // 10 (first introduction past limit), and `used == limit + 1` returns
    // 15 (second past). Calling after incrementing would double-count
    // excess. Verified against existing factory-insights.ts:103 caller.
    const penalty = preIncrement.used >= preIncrement.limit
      ? getGridPenalty(preIncrement)
      : 0
    const incremented: ComponentAllocation = {
      ...preIncrement,
      used: preIncrement.used + 1,
    }
    workingComponents = [
      ...workingComponents.slice(0, idx),
      incremented,
      ...workingComponents.slice(idx + 1),
    ]
    if (penalty > 0) {
      gridPenaltyByDriver[swap.driverId] =
        (gridPenaltyByDriver[swap.driverId] ?? 0) + penalty
      penaltiesIncurred += 1
    }
  }

  return {
    team: {
      ...team,
      components: workingComponents,
      pendingComponentSwaps: [],
      penaltiesTaken: team.penaltiesTaken + penaltiesIncurred,
    },
    gridPenaltyByDriver,
  }
}

/**
 * Increment `used + 1` on every PU element. Called once per team per race
 * by the post-race processor — represents the wear of running every PU
 * element through one race weekend, regardless of which driver "used" it
 * (we model the PU pool as team-shared). Pure; does not trigger penalties
 * (only `applyPendingSwaps` ever increments `penaltiesTaken`).
 */
export function tickComponentWear(team: Team): Team {
  return {
    ...team,
    components: team.components.map((c) => ({ ...c, used: c.used + 1 })),
  }
}
