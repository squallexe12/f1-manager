/**
 * Tier B v2 — pit-crew staff types.
 *
 * IP-B2 ships these as the Tier B persistence schema (v11 → v12). The
 * `StaffContract` shape mirrors driver `Contract` so a future Tier B+ cycle
 * can graduate from fixed-salary v2 to driver-style negotiation additively
 * without a schema break (Q8-A → Q8-B in the brainstorm).
 */

/**
 * The seven gameplay-meaningful pit-crew roles. The `lollipop` slot models
 * the release supervisor (modern F1 uses an automated traffic light, but
 * the lollipop name is preserved for clarity); the remaining six are
 * tyre-change specialists.
 */
export type PitCrewRole =
  | 'lollipop'
  | 'front-jack'
  | 'rear-jack'
  | 'wheel-off-front'
  | 'wheel-on-front'
  | 'wheel-off-rear'
  | 'wheel-on-rear'

/** Six roles for hireable members; the `lollipop` is treated as the chief's release deputy. */
export const PIT_CREW_MEMBER_ROLES: PitCrewRole[] = [
  'lollipop',
  'front-jack',
  'rear-jack',
  'wheel-off-front',
  'wheel-on-front',
  'wheel-off-rear',
  'wheel-on-rear',
]

/**
 * Salary-only contract shape for IP-B2. Mirrors driver `Contract` so future
 * cycles can additively populate `performanceBonuses` and `releaseClause`.
 */
export interface StaffContract {
  /** Per-season salary; deducted from the team's `Salaries` budget category. */
  salary: number
  /** Absolute season number at which this contract expires. */
  termEndSeason: number
  /** v2 always empty; reserved for future driver-style negotiation. */
  performanceBonuses: { condition: string; value: number }[]
  /** v2 always null; reserved for future negotiation. */
  releaseClause: number | null
}

/**
 * Pit-crew chief. Multi-axis attributes that map (via
 * `aggregateCrewRatings`) to the engine's three sub-attribute inputs.
 */
export interface PitCrewChief {
  id: string
  firstName: string
  lastName: string
  nationality: string
  age: number
  /** 0–100 — feeds engine `release` input. Lollipop / release-decision quality. */
  releaseSupervision: number
  /** 0–100 — feeds engine `speedDiscipline` input. Pit-lane speed coaching. */
  speedDisciplineCoaching: number
  /** 0–100 — feeds engine `serviceTime` input. Crew coordination, choreography. */
  serviceCoordination: number
  contract: StaffContract
}

/**
 * Individual pit-crew member. Single rating attribute; role determines how
 * that rating contributes to the team's aggregate sub-attributes.
 */
export interface PitCrewMember {
  id: string
  firstName: string
  lastName: string
  nationality: string
  age: number
  role: PitCrewRole
  /** 0–100 single-axis rating. */
  rating: number
  contract: StaffContract
}

/**
 * Pit-crew staff currently in the free-agent pool, awaiting hire. Same shape
 * as employed staff (so the hire transition is a move, not a transform).
 * Members carry their preferred role; chiefs do not have a role field.
 */
export type FreeAgentChief = PitCrewChief
export type FreeAgentMember = PitCrewMember

/**
 * Season-scoped talent pool. Refreshed by the orchestrator at season start
 * via `generateTalentPool(seed, season, poolSize)`.
 */
export interface StaffMarket {
  chiefs: FreeAgentChief[]
  members: FreeAgentMember[]
  /** Most recent season for which the pool was regenerated. 0 means "never". */
  lastRefreshedSeason: number
}

/**
 * AI-team poaching attempt against the player. Drained by counter-offer UI.
 * Logic ships in IP-B3; the persisted slot lands in IP-B2 so saves don't
 * need a follow-up schema bump.
 */
export interface PoachingAttempt {
  /** Driver-id-style: deterministic from (rivalTeamId, targetStaffId, round). */
  id: string
  rivalTeamId: string
  targetStaffId: string
  /** Which slot the rival is offering: chief vs. member-by-role. */
  offeredRole: 'chief' | PitCrewRole
  offeredSalary: number
  raisedOnRound: number
  expiresOnRound: number
  status: 'open' | 'matched' | 'declined' | 'expired'
}
