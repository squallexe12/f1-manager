import type { PitCrewChief, PitCrewMember, StaffMarket } from '@/types/staff'

/**
 * Tier B v2 — pit-crew hiring helpers.
 *
 * All functions are pure: take current market + team-slot state, return new
 * market + team-slot state. The caller (gameStore action) is responsible
 * for splicing the returned values into `world.staffMarket` and the
 * appropriate `team.pitCrewChief` / `team.pitCrewMembers`.
 *
 * Fired-staff decay: 2 points off each attribute on dismissal. Models
 * career setback when a previously employed member returns to the open
 * market. Calibration; tune if playtest shows unwanted churn dynamics.
 */

const FIRED_DECAY = 2

export interface HireChiefResult {
  market: StaffMarket
  team: {
    pitCrewChief: PitCrewChief | null
    pitCrewMembers: PitCrewMember[]
  }
}

export interface HireMemberResult {
  market: StaffMarket
  team: {
    pitCrewChief: PitCrewChief | null
    pitCrewMembers: PitCrewMember[]
  }
}

function decayChief(c: PitCrewChief): PitCrewChief {
  return {
    ...c,
    releaseSupervision: Math.max(0, c.releaseSupervision - FIRED_DECAY),
    speedDisciplineCoaching: Math.max(0, c.speedDisciplineCoaching - FIRED_DECAY),
    serviceCoordination: Math.max(0, c.serviceCoordination - FIRED_DECAY),
  }
}

function decayMember(m: PitCrewMember): PitCrewMember {
  return { ...m, rating: Math.max(0, m.rating - FIRED_DECAY) }
}

/**
 * Hire a free-agent chief by id. If a chief is currently employed, they're
 * auto-fired (returned to the market with attribute decay) before the new
 * chief is installed. No-op if `staffId` is not in the market.
 */
export function hireChief(
  market: StaffMarket,
  currentChief: PitCrewChief | null,
  currentMembers: PitCrewMember[],
  staffId: string,
): HireChiefResult {
  const target = market.chiefs.find((c) => c.id === staffId)
  if (!target) {
    return { market, team: { pitCrewChief: currentChief, pitCrewMembers: currentMembers } }
  }
  const remainingChiefs = market.chiefs.filter((c) => c.id !== staffId)
  // Auto-fire existing chief if any.
  const firedChiefList = currentChief ? [decayChief(currentChief)] : []
  return {
    market: {
      ...market,
      chiefs: [...remainingChiefs, ...firedChiefList],
    },
    team: {
      pitCrewChief: target,
      pitCrewMembers: currentMembers,
    },
  }
}

/**
 * Fire the currently employed chief, returning them to the free-agent
 * market with attribute decay. No-op if no chief is employed.
 */
export function fireChief(
  market: StaffMarket,
  currentChief: PitCrewChief | null,
  currentMembers: PitCrewMember[],
): HireChiefResult {
  if (currentChief === null) {
    return { market, team: { pitCrewChief: null, pitCrewMembers: currentMembers } }
  }
  return {
    market: {
      ...market,
      chiefs: [...market.chiefs, decayChief(currentChief)],
    },
    team: {
      pitCrewChief: null,
      pitCrewMembers: currentMembers,
    },
  }
}

/**
 * Hire a free-agent member by id. If a member already occupies the same
 * role on the team, they're auto-fired (returned to the market with
 * attribute decay) before the new member is installed. No-op if `staffId`
 * is not in the market.
 */
export function hireMember(
  market: StaffMarket,
  currentChief: PitCrewChief | null,
  currentMembers: PitCrewMember[],
  staffId: string,
): HireMemberResult {
  const target = market.members.find((m) => m.id === staffId)
  if (!target) {
    return { market, team: { pitCrewChief: currentChief, pitCrewMembers: currentMembers } }
  }
  const remainingMarketMembers = market.members.filter((m) => m.id !== staffId)
  // Auto-fire any existing occupant of this role.
  const occupant = currentMembers.find((m) => m.role === target.role)
  const firedMembers = occupant ? [decayMember(occupant)] : []
  const newRoster = currentMembers.filter((m) => m.role !== target.role).concat(target)
  return {
    market: {
      ...market,
      members: [...remainingMarketMembers, ...firedMembers],
    },
    team: {
      pitCrewChief: currentChief,
      pitCrewMembers: newRoster,
    },
  }
}

/**
 * Fire a roster member by id. Returns them to the free-agent market with
 * attribute decay. No-op if `staffId` is not on the team.
 */
export function fireMember(
  market: StaffMarket,
  currentChief: PitCrewChief | null,
  currentMembers: PitCrewMember[],
  staffId: string,
): HireMemberResult {
  const target = currentMembers.find((m) => m.id === staffId)
  if (!target) {
    return { market, team: { pitCrewChief: currentChief, pitCrewMembers: currentMembers } }
  }
  return {
    market: {
      ...market,
      members: [...market.members, decayMember(target)],
    },
    team: {
      pitCrewChief: currentChief,
      pitCrewMembers: currentMembers.filter((m) => m.id !== staffId),
    },
  }
}
