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

/**
 * Project the total grid penalty the named driver would incur if their
 * currently-queued swaps were applied immediately. Uses the same
 * arithmetic as `applyPendingSwaps` — guarantees the UI projection
 * matches the actual penalty when the swap drains. Returns 0 when no
 * swaps are queued for the driver.
 *
 * Penalty calculation is PRE-INCREMENT (matches `applyPendingSwaps` and
 * `factory-insights.ts:103` precedent): `getGridPenalty` is called on
 * the un-incremented allocation, guarded by `preIncrement.used >= limit`.
 */
export function projectedGridLossIfElectedNow(team: Team, driverId: string): number {
  const driverSwaps = team.pendingComponentSwaps.filter((s) => s.driverId === driverId)
  if (driverSwaps.length === 0) return 0
  let workingComponents = team.components.map((c) => ({ ...c }))
  let total = 0
  for (const swap of driverSwaps) {
    const idx = workingComponents.findIndex((c) => c.element === swap.element)
    if (idx < 0) continue
    const preIncrement = workingComponents[idx]
    // PRE-INCREMENT calculation — same semantics as `applyPendingSwaps`.
    if (preIncrement.used >= preIncrement.limit) {
      total += getGridPenalty(preIncrement)
    }
    workingComponents = [
      ...workingComponents.slice(0, idx),
      { ...preIncrement, used: preIncrement.used + 1 },
      ...workingComponents.slice(idx + 1),
    ]
  }
  return total
}

export interface SwapRow {
  driverId: string
  driverShortName: string
  element: ComponentElement
  used: number
  limit: number
  band: 'warning' | 'danger'
  projectedPenalty: number
  elected: boolean
}

/**
 * Render-ready rows for the Component Strategy sub-section in the
 * Factory Power Unit card. One row per (driver × element) where the
 * next introduction would hit or exceed the season limit. The UI
 * decides which to show; the engine just tells it the band, the
 * numbers, and whether a swap is already elected for that pair.
 *
 * Visual bands (locked from spec §4.2):
 * - `warning`: `used + 1 == limit` → last "free" introduction available.
 * - `danger`:  `used + 1 >  limit` → next introduction will incur a penalty.
 */
export function componentSwapRows(
  team: Team,
  playerDrivers: ReadonlyArray<{ id: string; shortName: string }>,
): SwapRow[] {
  const rows: SwapRow[] = []
  for (const c of team.components) {
    const projection = c.used + 1
    if (projection < c.limit) continue
    const band: SwapRow['band'] = projection === c.limit ? 'warning' : 'danger'
    // PRE-INCREMENT penalty calculation, guarded by `c.used >= c.limit` so
    // warning-band rows (`c.used == c.limit - 1`) report `projectedPenalty: 0`
    // (their swap is the last free introduction and incurs no penalty).
    const penalty = c.used >= c.limit ? getGridPenalty(c) : 0
    for (const drv of playerDrivers) {
      const elected = team.pendingComponentSwaps.some(
        (s) => s.driverId === drv.id && s.element === c.element,
      )
      rows.push({
        driverId: drv.id,
        driverShortName: drv.shortName,
        element: c.element,
        used: c.used,
        limit: c.limit,
        band,
        projectedPenalty: penalty,
        elected,
      })
    }
  }
  return rows
}
