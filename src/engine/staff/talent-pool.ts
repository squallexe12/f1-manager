import { createPRNG, type PRNG } from '@/engine/core/prng'
import { sampleGaussian } from '@/engine/core/gaussian'
import {
  CHIEF_ATTR_DIST,
  CHIEF_SALARY,
  MEMBER_RATING_DIST,
  MEMBER_SALARY,
  STAFF_AGE_RANGE,
  STAFF_POOL_DEFAULTS,
} from '@/data/staff-distributions'
import { PIT_CREW_MEMBER_ROLES, type PitCrewChief, type PitCrewMember, type StaffMarket } from '@/types/staff'
import { generateIdentity } from './procgen-names'

/**
 * Tier B v2 — procgen pit-crew talent pool.
 *
 * Determinism contract: same `(seed, season)` always produces the same pool.
 * Salary scales linearly with attribute level. Members cycle through all
 * seven `PitCrewRole` slots so every role has at least one free agent
 * available when the pool is large enough.
 */

export const DEFAULT_STAFF_POOL_SIZE = STAFF_POOL_DEFAULTS

export interface PoolSizeInput {
  chiefs: number
  members: number
}

function clampGaussian(rng: PRNG, mean: number, stddev: number, min: number, max: number): number {
  const z = sampleGaussian(rng)
  const v = Math.round(mean + z * stddev)
  return Math.max(min, Math.min(max, v))
}

function buildChief(rng: PRNG, season: number, idx: number, chiefSeed: number): PitCrewChief {
  const id = `chief-${chiefSeed}-${season}-${idx}`
  const ident = generateIdentity(rng, STAFF_AGE_RANGE.min, STAFF_AGE_RANGE.max)
  const releaseSupervision = clampGaussian(rng, CHIEF_ATTR_DIST.mean, CHIEF_ATTR_DIST.stddev, CHIEF_ATTR_DIST.min, CHIEF_ATTR_DIST.max)
  const speedDisciplineCoaching = clampGaussian(rng, CHIEF_ATTR_DIST.mean, CHIEF_ATTR_DIST.stddev, CHIEF_ATTR_DIST.min, CHIEF_ATTR_DIST.max)
  const serviceCoordination = clampGaussian(rng, CHIEF_ATTR_DIST.mean, CHIEF_ATTR_DIST.stddev, CHIEF_ATTR_DIST.min, CHIEF_ATTR_DIST.max)
  const avgAttr = (releaseSupervision + speedDisciplineCoaching + serviceCoordination) / 3
  return {
    id,
    firstName: ident.firstName,
    lastName: ident.lastName,
    nationality: ident.nationality,
    age: ident.age,
    releaseSupervision,
    speedDisciplineCoaching,
    serviceCoordination,
    contract: {
      salary: Math.round(CHIEF_SALARY.base + avgAttr * CHIEF_SALARY.perAttr),
      termEndSeason: season + 2,
      performanceBonuses: [],
      releaseClause: null,
    },
  }
}

function buildMember(rng: PRNG, season: number, idx: number, memberSeed: number): PitCrewMember {
  const id = `member-${memberSeed}-${season}-${idx}`
  const ident = generateIdentity(rng, STAFF_AGE_RANGE.min, STAFF_AGE_RANGE.max)
  const role = PIT_CREW_MEMBER_ROLES[idx % PIT_CREW_MEMBER_ROLES.length]
  const rating = clampGaussian(rng, MEMBER_RATING_DIST.mean, MEMBER_RATING_DIST.stddev, MEMBER_RATING_DIST.min, MEMBER_RATING_DIST.max)
  return {
    id,
    firstName: ident.firstName,
    lastName: ident.lastName,
    nationality: ident.nationality,
    age: ident.age,
    role,
    rating,
    contract: {
      salary: Math.round(MEMBER_SALARY.base + rating * MEMBER_SALARY.perRating),
      termEndSeason: season + 2,
      performanceBonuses: [],
      releaseClause: null,
    },
  }
}

/**
 * Generate a deterministic free-agent pool for the given season. Single-PRNG
 * design: chiefs first (in id-sorted order), then members. Refresh policy
 * (replace retirees, etc.) handled by future seasons re-running this with
 * `season + 1`; IP-B2 ships only the initial generation.
 */
export function generateTalentPool(
  seed: number,
  season: number,
  poolSize: PoolSizeInput,
): StaffMarket {
  const rng = createPRNG(seed * 1009 + season * 31)

  const chiefs: PitCrewChief[] = []
  for (let i = 0; i < poolSize.chiefs; i++) {
    chiefs.push(buildChief(rng, season, i, seed))
  }

  const members: PitCrewMember[] = []
  for (let i = 0; i < poolSize.members; i++) {
    members.push(buildMember(rng, season, i, seed))
  }

  return {
    chiefs,
    members,
    lastRefreshedSeason: season,
  }
}
