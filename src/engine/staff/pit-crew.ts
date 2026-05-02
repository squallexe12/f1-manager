import type { PitCrewChief, PitCrewMember, PitCrewRole } from '@/types/staff'

/**
 * Tier B v2 — staff aggregation. Maps the chief + 6 hireable members to
 * the engine's three sub-attribute inputs (`release`, `speedDiscipline`,
 * `serviceTime`).
 *
 * Weights per spec §5.7:
 *   - Chief contributes ~60% to `release`, ~50% to `speedDiscipline`,
 *     ~30% to `serviceTime`.
 *   - Members contribute the remainder, weighted by role:
 *     • Lollipop dominates `release` among members.
 *     • All members contribute equally to `serviceTime`.
 *     • Members contribute marginally to `speedDiscipline` (driver-side
 *       attribute; mostly chief-coached).
 *
 * IP-B2 ships this as a pure function. IP-B3 wires it into the
 * race-simulator's `simulatePitLane` call site.
 */

// Tier B v2 — empty-staff baseline. Engine reads each team's ratings
// uniformly; if "no staff" returned 50, AI cars (which start with no chief
// and no members) would have ~10× the speeding rate of real F1. 70 is the
// "default-quality crew" baseline IP-B1 was tuned against — a player who
// hasn't hired anyone perceives no penalty until they invest, and AI teams
// behave realistically. A player who hires a low-rated chief can drop
// BELOW this baseline; that's the tradeoff the gameplay surfaces.
const NEUTRAL_BASELINE = 70
const NEUTRAL_MEMBER_FILL = 70

export interface CrewAggregates {
  release: number
  speedDiscipline: number
  serviceTime: number
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function ratingForRole(members: PitCrewMember[], role: PitCrewRole): number {
  const found = members.find((m) => m.role === role)
  return found ? found.rating : NEUTRAL_MEMBER_FILL
}

function averageRating(members: PitCrewMember[]): number {
  if (members.length === 0) return NEUTRAL_MEMBER_FILL
  return members.reduce((s, m) => s + m.rating, 0) / members.length
}

function nonLollipopAverage(members: PitCrewMember[]): number {
  const non = members.filter((m) => m.role !== 'lollipop')
  return averageRating(non)
}

export function aggregateCrewRatings(
  chief: PitCrewChief | null,
  members: PitCrewMember[],
): CrewAggregates {
  if (chief === null) {
    return { release: NEUTRAL_BASELINE, speedDiscipline: NEUTRAL_BASELINE, serviceTime: NEUTRAL_BASELINE }
  }

  // Release: chief coaches the release call (55%), lollipop is the in-the-moment
  // decision-maker (30%), other members tangentially affect car positioning at
  // release moment (15%).
  const lollipopRating = ratingForRole(members, 'lollipop')
  const otherAvg = nonLollipopAverage(members)
  const release =
    chief.releaseSupervision * 0.55 +
    lollipopRating * 0.30 +
    otherAvg * 0.15

  // Speed discipline: dominated by chief coaching (85%); members add small
  // procedure-level discipline (15%).
  const allMembersAvg = averageRating(members)
  const speedDiscipline =
    chief.speedDisciplineCoaching * 0.85 +
    allMembersAvg * 0.15

  // Service time: choreography matters more for actual stop time. Chief
  // coordinates (30%); the seven members determine raw mechanical speed (70%).
  const serviceTime =
    chief.serviceCoordination * 0.30 +
    allMembersAvg * 0.70

  return {
    release: clamp(Math.round(release), 0, 100),
    speedDiscipline: clamp(Math.round(speedDiscipline), 0, 100),
    serviceTime: clamp(Math.round(serviceTime), 0, 100),
  }
}
