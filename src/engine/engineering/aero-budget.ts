import type { Team, RndUpgrade, AeroBooking, UpgradeOutcome } from '@/types/team'
import { calculateOverallRating } from './car-performance'
import { correlationDelta as correlationDeltaHash } from './factory-insights'

/**
 * Phase 3 (Box 3): real WT/CFD consumption tied to in-progress R&D upgrades,
 * persistent CDT booking ledger, and predicted-vs-actual upgrade correlation.
 *
 * Pure functions. No PRNG, no side effects. The orchestrator drives the
 * cycle (`processManagementEntry`) and post-race (`processPostRace`)
 * boundaries; this module is the single source of truth for the math.
 */

/** FIFO cap on `team.aeroBookings` — one entry per day in the CDT window. */
export const AERO_BOOKINGS_CAP = 14

/** FIFO cap on `team.upgradeOutcomes` — last 3 deliveries averaged. */
export const UPGRADE_OUTCOMES_CAP = 3

/** Hard ±10% bound on the correlation Δ readout. */
const CORRELATION_BOUND = 10

export interface ConsumeAeroBudgetResult {
  team: Team
  /**
   * Ids of upgrades whose progress tick must be skipped this cycle because
   * their per-cycle WT or CFD cost would push the team's window total
   * over its limit. Spec contract: once one upgrade in the lex-asc id
   * order stalls, every later upgrade also stalls regardless of individual
   * fit (deterministic ordering for the replay gate).
   */
  stalledUpgradeIds: string[]
}

/**
 * Deduct each in-progress upgrade's `wtHoursPerCycle` and `cfdRunsPerCycle`
 * from the team's running CDT-window totals. Stalls upgrades that would
 * overflow either budget. Appends one `AeroBooking` entry per cycle (FIFO
 * trimmed to `AERO_BOOKINGS_CAP`).
 *
 * Stall semantics (spec §4.3): upgrades are processed in ascending lexical
 * id order. The first upgrade whose deduction would push WT or CFD past
 * the limit stalls; every subsequent upgrade in the order also stalls
 * regardless of individual fit. This is a determinism contract — the same
 * (team, currentDay) input must always produce the same stall set so a
 * replay against the same seed reproduces the cycle byte-for-byte.
 */
export function consumeAeroBudget(team: Team, currentDay: number): ConsumeAeroBudgetResult {
  const inProgress = team.rndUpgrades
    .filter((u) => u.status === 'in-progress')
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

  let wtUsed = team.windTunnelHoursUsed
  let cfdUsed = team.cfdRunsUsed
  let wtSpent = 0
  let cfdSpent = 0
  const stalledUpgradeIds: string[] = []
  let stallTriggered = false

  for (const upgrade of inProgress) {
    if (stallTriggered) {
      stalledUpgradeIds.push(upgrade.id)
      continue
    }
    const nextWt = wtUsed + upgrade.wtHoursPerCycle
    const nextCfd = cfdUsed + upgrade.cfdRunsPerCycle
    const overflowsWt = nextWt > team.windTunnelHoursLimit
    const overflowsCfd = nextCfd > team.cfdRunsLimit
    if (overflowsWt || overflowsCfd) {
      stalledUpgradeIds.push(upgrade.id)
      stallTriggered = true
      continue
    }
    wtUsed = nextWt
    cfdUsed = nextCfd
    wtSpent += upgrade.wtHoursPerCycle
    cfdSpent += upgrade.cfdRunsPerCycle
  }

  const booking: AeroBooking = { day: currentDay, wtHours: wtSpent, cfdRuns: cfdSpent }
  const nextBookings = [...team.aeroBookings, booking].slice(-AERO_BOOKINGS_CAP)

  return {
    team: {
      ...team,
      windTunnelHoursUsed: wtUsed,
      cfdRunsUsed: cfdUsed,
      aeroBookings: nextBookings,
    },
    stalledUpgradeIds,
  }
}

/**
 * Reset the team's CDT-window state at the window boundary: zero the
 * running WT/CFD usage counters and clear the per-day booking ledger.
 * Limits, in-progress upgrades, and unrelated state are preserved.
 */
export function resetAeroWindow(team: Team): Team {
  return {
    ...team,
    windTunnelHoursUsed: 0,
    cfdRunsUsed: 0,
    aeroBookings: [],
  }
}

/**
 * Capture an `UpgradeOutcome` snapshot at the moment an upgrade flips
 * to `complete`. `predictedOvrDelta` is the sum of the upgrade's
 * `performanceDelta` axis values; `ovrAtDelivery` is the team's car-OVR
 * computed from `team.car` at the same moment so the predicted-vs-actual
 * comparison has a stable baseline that `ovrHistory` (capped at 12) cannot
 * always provide.
 *
 * Returns null if the upgrade id is not on the team, so the caller can
 * cleanly skip when the diff suggests something out of scope.
 */
export function snapshotUpgradePrediction(
  team: Team,
  upgradeId: string,
  currentRound: number,
): UpgradeOutcome | null {
  const upgrade = team.rndUpgrades.find((u) => u.id === upgradeId)
  if (!upgrade) return null
  const predicted = sumPerformanceDelta(upgrade)
  return {
    upgradeId,
    deliveredRound: currentRound,
    predictedOvrDelta: predicted,
    ovrAtDelivery: calculateOverallRating(team.car),
    actualOvrDelta: null,
  }
}

/**
 * Fill `actualOvrDelta` on any outcome whose `deliveredRound < currentRound`
 * and whose actual delta has not yet been measured. Idempotent: a second
 * call after measurement is a no-op. Returns the same `Team` reference
 * when no outcome needs updating, so equality-sensitive callers (Zustand
 * subscribers, autosave) don't see false-positive churn.
 *
 * Why "first race AFTER delivery": an upgrade that completes during the
 * management cycle preceding round N is measured against round N's outcome.
 * The strict `<` comparison guarantees the round-of-delivery race itself
 * never resolves the outcome — the player's car must actually run a full
 * race carrying the upgrade before we judge correlation.
 */
export function measureUpgradeOutcome(team: Team, currentRound: number): Team {
  const currentOvr = calculateOverallRating(team.car)
  let mutated = false
  const next = team.upgradeOutcomes.map((o) => {
    if (o.actualOvrDelta !== null) return o
    if (o.deliveredRound >= currentRound) return o
    mutated = true
    return { ...o, actualOvrDelta: currentOvr - o.ovrAtDelivery }
  })
  if (!mutated) return team
  return { ...team, upgradeOutcomes: next }
}

/**
 * Compute the correlation Δ readout for the Factory aero card from the
 * team's measured upgrade outcomes. Averages `(actual - predicted) / predicted × 100`
 * over the rolling buffer; clamps the result to ±`CORRELATION_BOUND`.
 *
 * Falls back to the legacy hash-based `correlationDelta()` when no
 * outcomes have yet been measured — keeps a sensible (deterministic, small)
 * value on the card for early-season rounds before the first delivery
 * resolves. Outcomes with `predictedOvrDelta === 0` are skipped to avoid
 * divide-by-zero; outcomes with `actualOvrDelta === null` are skipped
 * because they have not yet been measured.
 */
export function correlationDeltaFromOutcomes(team: Team, currentRound: number): number {
  const measured = team.upgradeOutcomes.filter(
    (o) => o.actualOvrDelta !== null && o.predictedOvrDelta !== 0,
  )
  if (measured.length === 0) return correlationDeltaHash(team.id, currentRound)
  const totalPct = measured.reduce((acc, o) => {
    const pct = ((o.actualOvrDelta as number) - o.predictedOvrDelta) / o.predictedOvrDelta * 100
    return acc + pct
  }, 0)
  const avg = totalPct / measured.length
  const clamped = Math.max(-CORRELATION_BOUND, Math.min(CORRELATION_BOUND, avg))
  return Number(clamped.toFixed(1))
}

function sumPerformanceDelta(upgrade: RndUpgrade): number {
  let total = 0
  for (const v of Object.values(upgrade.performanceDelta)) {
    if (typeof v === 'number') total += v
  }
  return total
}
