import type { Driver } from '@/types/driver'
import type { PrestigeRating } from '@/types/finance'
import type { FullGameState } from '@/engine/core/state-manager'

/**
 * Computed asking salary for a free agent. Pure derivation from attributes —
 * never persisted on Driver. Stable: same attributes → same salary.
 *
 * Weighting reflects driver-value heuristics:
 *   pace × 80k        — raw speed dominates
 *   racecraft × 60k   — wheel-to-wheel value
 *   devPotential × 40k — future ceiling (premium for young prospects)
 *   experience × 30k  — consistency / wet weather
 *   marketability × 50k — sponsor appeal
 *
 * Returns salary rounded to nearest $1,000. Compressed relative to real
 * F1 salaries (Verstappen IRL ~$55M; this formula yields ~$20M for a
 * 95-pace star) — see spec §3.1 for the rationale.
 */
export function expectedSalary(driver: Driver): number {
  const a = driver.attributes
  const raw =
    a.pace * 80_000 +
    a.racecraft * 60_000 +
    a.developmentPotential * 40_000 +
    a.experience * 30_000 +
    a.marketability * 50_000
  return Math.round(raw / 1000) * 1000
}

/**
 * Per-tier prestige modifier for the salary acceptance floor.
 *
 *   A+ → -0.15  (top teams pay 15% less to attract drivers)
 *   A  → -0.10
 *   B+ → -0.07
 *   B  → -0.04
 *   C+ → -0.01
 *   C  →  0.00
 *   D  → +0.07
 *   F  → +0.15  (bottom teams pay 15% premium)
 *
 * Note: there is no E tier — `PrestigeRating` is 8 levels, see
 * `src/types/finance.ts`.
 */
const PRESTIGE_MODIFIER: Record<PrestigeRating, number> = {
  'A+': -0.15,
  'A': -0.10,
  'B+': -0.07,
  'B': -0.04,
  'C+': -0.01,
  'C': 0.00,
  'D': 0.07,
  'F': 0.15,
}

/**
 * Player team's acceptance floor — the minimum salary at which the driver
 * will sign. Wraps `expectedSalary` with a prestige modifier.
 *
 * Returns the floor rounded to nearest $1,000.
 */
export function acceptanceFloor(driver: Driver, prestige: PrestigeRating): number {
  const base = expectedSalary(driver)
  const modifier = PRESTIGE_MODIFIER[prestige]
  return Math.round(base * (1 + modifier) / 1000) * 1000
}

export interface OfferTerms {
  /** Annual salary in USD. */
  salary: number
  /** Contract length in seasons (1 / 2 / 3). Informational for v1 — does not affect acceptance. */
  termYears: 1 | 2 | 3
}

export interface OfferResult {
  accepted: boolean
  /** The acceptance floor for this driver and prestige tier — surfaced so UI can show "your offer is $X below market". */
  floor: number
  /** Populated only when `accepted === false`. */
  reason?: string
}

/**
 * Evaluate whether a driver accepts a given offer. Pure, deterministic.
 *
 * Acceptance: `offer.salary >= acceptanceFloor(driver, prestige)`.
 * Term length is informational for v1 and does not affect acceptance.
 */
export function evaluateOffer(
  driver: Driver,
  offer: OfferTerms,
  prestige: PrestigeRating,
): OfferResult {
  const floor = acceptanceFloor(driver, prestige)
  if (offer.salary >= floor) {
    return { accepted: true, floor }
  }
  return {
    accepted: false,
    floor,
    reason: 'Holding out for better terms — your offer is below market',
  }
}

export type RosterSlot = 'CAR-01' | 'CAR-02' | 'RESERVE'

export interface SigningParams {
  driverId: string
  offer: OfferTerms
  slotChoice: RosterSlot
  /** Existing driver to displace into the free-agent pool; null when target slot is empty. */
  displaceDriverId: string | null
}

export interface SigningResult {
  world: FullGameState
  signedDriver: Driver
  displacedDriver: Driver | null
}

/**
 * Apply an accepted signing to world state. Pure (returns new world).
 *
 * Mutations:
 *   - signed driver: teamId ← playerTeamId, contract ← new Contract from offer
 *   - displaced driver (if any): teamId ← null, contract ← null. All other
 *     fields (seasonStats, attributes, mood, careerStarts, etc.) preserved.
 *
 * Caller (the store action) MUST verify acceptance via evaluateOffer before
 * calling. signFreeAgent does NOT re-evaluate.
 *
 * Throws when invariants are violated:
 *   - target driver is not a free agent (teamId !== null)
 *   - displaceDriverId is null but the slot is currently occupied
 *   - displaceDriverId is set but the named driver is not in the slot
 */
export function signFreeAgent(
  world: FullGameState,
  playerTeamId: string,
  params: SigningParams,
): SigningResult {
  const targetDriver = world.drivers.find(d => d.id === params.driverId)
  if (!targetDriver) {
    throw new Error(`signFreeAgent: driver ${params.driverId} not found`)
  }
  if (targetDriver.teamId !== null) {
    throw new Error(`signFreeAgent: driver ${params.driverId} is not a free agent`)
  }

  // Verify the slot/displacement consistency.
  const occupant = findSlotOccupant(world, playerTeamId, params.slotChoice)
  if (occupant && params.displaceDriverId === null) {
    throw new Error(`signFreeAgent: slot ${params.slotChoice} is occupied — displaceDriverId required`)
  }
  if (!occupant && params.displaceDriverId !== null) {
    throw new Error(`signFreeAgent: slot ${params.slotChoice} is empty — displaceDriverId must be null`)
  }
  if (occupant && occupant.id !== params.displaceDriverId) {
    throw new Error(`signFreeAgent: displaceDriverId ${params.displaceDriverId} does not occupy ${params.slotChoice}`)
  }

  const isReserveSlot = params.slotChoice === 'RESERVE'
  const newContract = {
    salary: params.offer.salary,
    termEndSeason: params.offer.termYears,
    performanceBonuses: [] as { condition: string; value: number }[],
    releaseClause: null as number | null,
  }

  const updatedDrivers = world.drivers.map(d => {
    if (d.id === targetDriver.id) {
      return { ...d, teamId: playerTeamId, contract: newContract, isReserve: isReserveSlot }
    }
    if (params.displaceDriverId && d.id === params.displaceDriverId) {
      return { ...d, teamId: null, contract: null, isReserve: false }
    }
    return d
  })

  const signedDriver = updatedDrivers.find(d => d.id === targetDriver.id)!
  const displacedDriver = params.displaceDriverId
    ? updatedDrivers.find(d => d.id === params.displaceDriverId) ?? null
    : null

  const updatedTeams = world.teams.map(t => {
    if (t.id !== playerTeamId) return t
    if (params.slotChoice === 'RESERVE') {
      return { ...t, reserveDriverId: params.driverId }
    }
    const idx = params.slotChoice === 'CAR-01' ? 0 : 1
    const driverIds = [...t.driverIds] as [string, string]
    driverIds[idx] = params.driverId
    return { ...t, driverIds }
  })

  return {
    world: { ...world, drivers: updatedDrivers, teams: updatedTeams },
    signedDriver,
    displacedDriver,
  }
}

export function findSlotOccupant(
  world: FullGameState,
  playerTeamId: string,
  slot: RosterSlot,
): Driver | null {
  const teamDrivers = world.drivers.filter(d => d.teamId === playerTeamId)
  if (slot === 'RESERVE') {
    return teamDrivers.find(d => d.isReserve) ?? null
  }
  // CAR-01 = first non-reserve, CAR-02 = second non-reserve. The order matches
  // the page composition's `playerDrivers[0]` / `playerDrivers[1]` semantics.
  const cars = teamDrivers.filter(d => !d.isReserve)
  return slot === 'CAR-01' ? cars[0] ?? null : cars[1] ?? null
}
