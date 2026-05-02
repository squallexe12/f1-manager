import type { Team } from '@/types/team'
import type { FinanceState } from '@/types/finance'
import type { PoachingAttempt, StaffMarket } from '@/types/staff'
import type { PRNG } from '@/engine/core/prng'
import { aggregateCrewRatings } from './pit-crew'

/**
 * Tier B v2 — poaching evaluation.
 *
 * Scans rival AI teams. When an AI team's pit-crew quality is materially
 * below the player's AND the AI has budget headroom, raises a single
 * `PoachingAttempt` targeting one of the player's staff. One attempt per
 * evaluation (rate-limited; the player isn't spammed).
 *
 * Determinism: same `(seed, currentRound, world-state)` produces the same
 * outcome. The orchestrator step that calls this passes a per-round PRNG so
 * subsequent rounds produce different attempts deterministically.
 */

const QUALITY_GAP_THRESHOLD = 12 // points of OVR aggregate
const MIN_BUDGET_HEADROOM = 30_000_000 // need this much un-allocated headroom to make an offer
const SALARY_PREMIUM = 1.4 // rival offers 40% above current salary
const ATTEMPT_WINDOW_LAPS = 3 // open for this many rounds before auto-expire
const PER_ROUND_FIRE_PROBABILITY = 0.35 // ~35% chance per evaluation when conditions are met

export interface PoachingEvalInput {
  playerTeamId: string
  teams: Team[]
  finance: Record<string, FinanceState>
  currentRound: number
  currentSeason: number
  existingAttempts: PoachingAttempt[]
  market: StaffMarket
}

export interface PoachingEvalResult {
  attempts: PoachingAttempt[]
}

function teamCrewQuality(team: Team): number {
  const r = aggregateCrewRatings(team.pitCrewChief, team.pitCrewMembers)
  return (r.release + r.speedDiscipline + r.serviceTime) / 3
}

function budgetHeadroom(finance: FinanceState | undefined): number {
  if (!finance) return 0
  return Math.max(0, finance.budget.cap - finance.budget.totalSpent)
}

export function evaluatePoachingAttempts(
  input: PoachingEvalInput,
  rng: PRNG,
): PoachingEvalResult {
  const playerTeam = input.teams.find((t) => t.id === input.playerTeamId)
  if (!playerTeam) return { attempts: [] }
  if (playerTeam.pitCrewChief === null && playerTeam.pitCrewMembers.length === 0) {
    return { attempts: [] }
  }

  const playerQuality = teamCrewQuality(playerTeam)

  // Gather AI teams that have meaningfully worse crews + spare budget.
  const candidates = input.teams
    .filter((t) => t.id !== input.playerTeamId)
    .filter((t) => playerQuality - teamCrewQuality(t) >= QUALITY_GAP_THRESHOLD)
    .filter((t) => budgetHeadroom(input.finance[t.id]) >= MIN_BUDGET_HEADROOM)
    .sort((a, b) => a.id.localeCompare(b.id))

  if (candidates.length === 0) return { attempts: [] }
  if (!rng.chance(PER_ROUND_FIRE_PROBABILITY)) return { attempts: [] }

  // Pick one rival team deterministically (PRNG draw).
  const rival = candidates[Math.floor(rng.next() * candidates.length)]

  // Pick the player's most attractive uncontested staff target. Prefer the
  // chief if any; otherwise the highest-rated member.
  const openTargetIds = new Set(
    input.existingAttempts.filter((a) => a.status === 'open').map((a) => a.targetStaffId),
  )

  type Target = {
    staffId: string
    role: 'chief' | PoachingAttempt['offeredRole']
    currentSalary: number
  }
  const possibleTargets: Target[] = []
  if (playerTeam.pitCrewChief && !openTargetIds.has(playerTeam.pitCrewChief.id)) {
    possibleTargets.push({
      staffId: playerTeam.pitCrewChief.id,
      role: 'chief',
      currentSalary: playerTeam.pitCrewChief.contract.salary,
    })
  }
  for (const m of playerTeam.pitCrewMembers) {
    if (openTargetIds.has(m.id)) continue
    possibleTargets.push({ staffId: m.id, role: m.role, currentSalary: m.contract.salary })
  }

  if (possibleTargets.length === 0) return { attempts: [] }

  // Sort by current salary descending so attractive targets surface first.
  possibleTargets.sort((a, b) => b.currentSalary - a.currentSalary)
  const target = possibleTargets[0]

  const attempt: PoachingAttempt = {
    id: `poach-${input.currentSeason}-${input.currentRound}-${rival.id}-${target.staffId}`,
    rivalTeamId: rival.id,
    targetStaffId: target.staffId,
    offeredRole: target.role,
    offeredSalary: Math.round(target.currentSalary * SALARY_PREMIUM),
    raisedOnRound: input.currentRound,
    expiresOnRound: input.currentRound + ATTEMPT_WINDOW_LAPS,
    status: 'open',
  }
  return { attempts: [attempt] }
}

/**
 * Per-round expiry pass. Marks open attempts whose `expiresOnRound` has
 * passed as `expired`. Pure: returns a new array.
 */
export function expirePoachingAttempts(
  attempts: PoachingAttempt[],
  currentRound: number,
): PoachingAttempt[] {
  return attempts.map((a) => {
    if (a.status === 'open' && currentRound > a.expiresOnRound) {
      return { ...a, status: 'expired' as const }
    }
    return a
  })
}
