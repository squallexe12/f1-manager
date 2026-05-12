/**
 * context-tags.ts — IP-10 Press Conference & Media Management
 *
 * Pure function that derives the set of PressContextTag values matching the
 * current world state for a given press surface and optional speaker driver.
 *
 * Tags are OR-matched downstream — a question is eligible if any of its
 * contextTags are in the returned set, OR it has no tags.
 *
 * Architecture invariant: this module is pure. No imports from stores, hooks,
 * components, or browser APIs. No PRNG. JSON-serializable inputs/outputs only.
 */

import type { FullGameState } from '@/engine/core/state-manager'
import type { PressContextTag, PressSurface } from '@/types/media'

// ---------------------------------------------------------------------------
// DNF sentinel — mirrors FORM_DNF in form-history.ts (value: 21).
// Copied here to keep this module dependency-free from the form-history module.
// ---------------------------------------------------------------------------
const DNF_SENTINEL = 21

// ---------------------------------------------------------------------------
// Home-race country → nationality normalization map.
// Circuit.country values (data/circuits.ts) use geographic country names;
// Driver.nationality values (data/drivers.ts) use demonym adjectives.
// Every entry in the 2026 calendar is covered here.
// ---------------------------------------------------------------------------
const COUNTRY_TO_NATIONALITY: Record<string, string> = {
  // Circuits where the country name does not equal the nationality adjective:
  'Australia':    'Australian',
  'Austria':      'Austrian',
  'Azerbaijan':   'Azerbaijani',
  'Bahrain':      'Bahraini',
  'Belgium':      'Belgian',
  'Brazil':       'Brazilian',
  'Canada':       'Canadian',
  'China':        'Chinese',
  'Great Britain':'British',
  'Hungary':      'Hungarian',
  'Italy':        'Italian',
  'Japan':        'Japanese',
  'Mexico':       'Mexican',
  'Monaco':       'Monegasque',
  'Netherlands':  'Dutch',
  'Qatar':        'Qatari',
  'Saudi Arabia': 'Saudi',
  'Singapore':    'Singaporean',
  'Spain':        'Spanish',
  'UAE':          'Emirati',
  'USA':          'American',
}

/**
 * Resolve a circuit country string to the driver nationality adjective used
 * in data/drivers.ts. Falls back to the country string unchanged for direct
 * matches (e.g. 'Australia' === 'Australian' still fails, but entries like
 * 'Italy' / 'Italian' are handled via the map too).
 */
function countryToNationality(country: string): string {
  return COUNTRY_TO_NATIONALITY[country] ?? country
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Derive the set of PressContextTag values that match the current world state
 * for the given surface and (optionally) speaker driver.
 *
 * Speaker-dependent tags (teammate comparison, contract, mood, home-race) are
 * silently skipped when speakerDriverId is undefined.
 *
 * @param world          - The full persisted game world.
 * @param surface        - Which press surface is being rendered.
 * @param speakerDriverId - The driver speaking (optional; required for speaker tags).
 */
export function deriveContextTags(
  world: FullGameState,
  surface: PressSurface,
  speakerDriverId?: string,
): PressContextTag[] {
  const tags = new Set<PressContextTag>()
  const { gameState, drivers, finance, calendar, poachingAttempts } = world
  const { currentRound, totalRaces, playerTeamId } = gameState

  // ----- Player team helpers ------------------------------------------------

  const playerDrivers = drivers.filter(
    d => d.teamId === playerTeamId && !d.isReserve,
  )

  const speakerDriver = speakerDriverId != null
    ? drivers.find(d => d.id === speakerDriverId) ?? null
    : null

  // Teammate: the other non-reserve player driver (excluding the speaker).
  const teammateDriver = speakerDriver != null
    ? playerDrivers.find(d => d.id !== speakerDriverId) ?? null
    : null

  // ----- Group 1: Round-based -----------------------------------------------

  if (currentRound === 1) {
    tags.add('season-opener')
  }
  if (currentRound === totalRaces) {
    tags.add('season-finale')
  }

  // ----- Group 2: Race-result-based (post-race surface only) ----------------

  if (surface === 'post-race') {
    const results = playerDrivers.map(d => d.lastRaceResult)

    // after-podium: any player driver finished P1–P3
    if (playerDrivers.some(d => d.lastRaceResult !== null && d.lastRaceResult <= 3)) {
      tags.add('after-podium')
    }

    // after-points: any player driver finished P4–P10 (not podium)
    if (
      playerDrivers.some(
        d => d.lastRaceResult !== null && d.lastRaceResult >= 4 && d.lastRaceResult <= 10,
      )
    ) {
      tags.add('after-points')
    }

    // after-zero-points: ALL player drivers scored no points (P11+ or DNF)
    // lastRaceResult null = no result yet — treat as no points.
    const allZeroPoints = playerDrivers.length > 0 && playerDrivers.every(
      d => d.lastRaceResult === null || d.lastRaceResult > 10,
    )
    if (allZeroPoints) {
      tags.add('after-zero-points')
    }

    // after-dnf: any player driver has a DNF (lastRaceResult >= DNF_SENTINEL)
    if (
      playerDrivers.some(
        d => d.lastRaceResult !== null && d.lastRaceResult >= DNF_SENTINEL,
      )
    ) {
      tags.add('after-dnf')
    }

    // after-crash: unreachable in v1 — race incident data (RaceIncident[]) is
    // session-scoped in store.lastRaceResults and is not persisted in FullGameState.
    // TODO IP-??: add crash incident tracking to FullGameState (e.g. world.lastRaceIncidents)
    // so this tag can fire without requiring store access from a pure function.

    // after-pole: unreachable in v1 — Driver has no gridPosition field; qualifying
    // grid positions are not persisted in FullGameState.
    // TODO IP-??: add Driver.lastQualifyingPosition (or similar) to FullGameState.

    // after-q1-exit: unreachable in v1 — same reason as after-pole.
    // TODO IP-??: same missing field as after-pole.

    // teammate-beat-you / beat-teammate (speaker-dependent, post-race only)
    if (speakerDriver !== null && teammateDriver !== null) {
      const sp = speakerDriver.lastRaceResult
      const tm = teammateDriver.lastRaceResult
      if (sp !== null && tm !== null) {
        if (sp > tm) {
          tags.add('teammate-beat-you')
        } else if (sp < tm) {
          tags.add('beat-teammate')
        }
        // Exact tie: neither tag emitted.
      }
    }

    // penalty-received: unreachable in v1 — AppliedPenalty[] from the race
    // worker's raceEnd event is session-scoped (store.lastRaceResults) and is
    // not persisted in FullGameState.
    // TODO IP-??: persist per-driver AppliedPenalty[] for last race in FullGameState
    // (e.g. world.lastRaceAppliedPenalties: Record<string, AppliedPenalty[]>).
  }

  // ----- Group 3: Driver state (speaker-dependent) --------------------------

  if (speakerDriver !== null) {
    // driver-mood-low / driver-mood-high
    const { motivation } = speakerDriver.mood
    if (motivation < 35) {
      tags.add('driver-mood-low')
    } else if (motivation > 75) {
      tags.add('driver-mood-high')
    }

    // contract-expiring: termEndSeason === 1 means contract ends this season.
    // Note: StagedStrategies (world.stagedStrategies) is keyed by driverId for
    // race strategies, not contract renewals — there is no "renewal staged" flag
    // in v1. The guard covers only the expiry condition.
    const contract = speakerDriver.contract
    if (contract !== null && contract.termEndSeason === 1) {
      tags.add('contract-expiring')
    }

    // rumored-poach: unreachable in v1 — world.poachingAttempts[].targetStaffId
    // targets pit-crew staff (PitCrewChief | PitCrewMember), not drivers.
    // The poaching system does not yet model driver poaching attempts.
    // TODO IP-??: extend PoachingAttempt to support driver targets, or add a
    // separate DriverPoachingAttempt type, so this tag can fire.
    void poachingAttempts // referenced to avoid "unused import" lint; guard is intentionally false.

    // home-race: circuit.country (normalized) matches speaker driver nationality
    const currentRace = calendar[currentRound - 1]
    if (currentRace !== undefined) {
      const circuitNationality = countryToNationality(currentRace.circuit.country)
      if (circuitNationality === speakerDriver.nationality) {
        tags.add('home-race')
      }
    }
  }

  // ----- Group 4: Finance ---------------------------------------------------

  const playerFinance = finance[playerTeamId]
  if (playerFinance !== undefined) {
    const { cap, totalSpent } = playerFinance.budget
    const remaining = cap - totalSpent
    const roundsRemaining = totalRaces - currentRound

    // budget-cap-pressure: remaining < 10% of cap AND >= 5 rounds left in season
    if (cap > 0 && remaining < 0.10 * cap && roundsRemaining >= 5) {
      tags.add('budget-cap-pressure')
    }
  }

  // prestige-rising: unreachable in v1 — FinanceState has prestige: PrestigeRating
  // and prestigeScore: number but no history array. Cannot determine direction of
  // change without at least two data points.
  // TODO IP-??: add FinanceState.prestigeHistory: number[] (rolling window of
  // prestigeScore snapshots, one per round) to enable trend detection.

  // prestige-falling: unreachable in v1 — same reason as prestige-rising.
  // TODO IP-??: same missing field as prestige-rising.

  // ----- Group 5: Regulation ------------------------------------------------

  // reg-controversy: unreachable in v1 — the regulation system uses RegulationChange
  // and TechnicalDirective types (data/regulations.ts) which have no `controversy`
  // field. There is no RegulationProposal type with voting or controversy scoring.
  // TODO IP-??: add RegulationProposal with controversy: number (0–1) to the
  // regulations data layer and surface it in FullGameState for this tag to fire.

  // ----- Done ---------------------------------------------------------------

  return Array.from(tags)
}
