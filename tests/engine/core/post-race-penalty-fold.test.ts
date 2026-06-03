import { describe, it, expect } from 'vitest'
import { processPostRace, type RaceResult } from '@/engine/core/post-race-processor'
import { createPRNG } from '@/engine/core/prng'
import { initializeGame } from '@/engine/core/state-manager'
import { DEFAULT_PENALTY_CALIBRATION } from '@/data/penalty-calibration'
import type { AppliedPenalty } from '@/types/race'
import type { PenaltyPointEntry } from '@/types/driver'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a full set of dummy results for all active (non-reserve, non-F2)
 *  drivers, placing `focusDriverId` at position 5 with the given penalties.
 */
function buildResults(
  allActiveIds: string[],
  focusDriverId: string,
  appliedPenalties: AppliedPenalty[],
): RaceResult[] {
  return allActiveIds.map((id, i) => ({
    driverId: id,
    position: i + 1,
    dnf: false,
    fastestLap: false,
    appliedPenalties: id === focusDriverId ? appliedPenalties : [],
  }))
}

/** A minimal 5-second, 1-point, warning-counted penalty. */
const MINOR_PENALTY: AppliedPenalty = {
  offenceType: 'collision-minor',
  sanction: '5s',
  timePenaltySeconds: 5,
  penaltyPointsIssued: 1,
  warningCounted: true,
  raceLap: 10,
}

/** A reprimand: no time, no points, counts as a warning. */
const REPRIMAND_PENALTY: AppliedPenalty = {
  offenceType: 'illegal-defending',
  sanction: 'reprimand',
  timePenaltySeconds: 0,
  penaltyPointsIssued: 0,
  warningCounted: true,
  raceLap: 5,
}

/** An egregious 2-point penalty (collision-serious minor tier = 2pts). */
const TWO_POINT_PENALTY: AppliedPenalty = {
  offenceType: 'collision-serious',
  sanction: '10s',
  timePenaltySeconds: 10,
  penaltyPointsIssued: 2,
  warningCounted: true,
  raceLap: 15,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('processPostRace — appliedPenalties fold', () => {
  it('time-penalty entry increments seasonStats.penalties and pushes a PenaltyPointEntry', () => {
    const world = initializeGame('mclaren', 'golden-era', 1)
    const activeIds = world.drivers
      .filter(d => d.teamId && !d.isReserve && !d.isF2)
      .map(d => d.id)
    const focusId = activeIds[0] // norris

    const results = buildResults(activeIds, focusId, [MINOR_PENALTY])

    const update = processPostRace(
      world.teams, world.drivers, world.finance,
      [], {}, results, null, false,
      1,        // currentRound
      2026,     // currentSeason
      'mclaren', world.gameState.totalRaces, world.boardExpectations, createPRNG(42),
    )

    const driver = update.drivers.find(d => d.id === focusId)!
    expect(driver.seasonStats.penalties).toBe(1)
    expect(driver.penaltyPoints).toHaveLength(1)
    expect(driver.penaltyPoints[0].points).toBe(1)
    expect(driver.penaltyPoints[0].offenceType).toBe('collision-minor')
    expect(driver.warningsThisSeason).toBe(1)
  })

  it('reprimand (timePenaltySeconds: 0) does NOT increment seasonStats.penalties', () => {
    const world = initializeGame('mclaren', 'golden-era', 1)
    const activeIds = world.drivers
      .filter(d => d.teamId && !d.isReserve && !d.isF2)
      .map(d => d.id)
    const focusId = activeIds[0]

    const results = buildResults(activeIds, focusId, [REPRIMAND_PENALTY])

    const update = processPostRace(
      world.teams, world.drivers, world.finance,
      [], {}, results, null, false,
      1, 2026,
      'mclaren', world.gameState.totalRaces, world.boardExpectations, createPRNG(43),
    )

    const driver = update.drivers.find(d => d.id === focusId)!
    expect(driver.seasonStats.penalties).toBe(0)
    expect(driver.warningsThisSeason).toBe(1)
    // No points entry because penaltyPointsIssued === 0
    expect(driver.penaltyPoints).toHaveLength(0)
  })

  it('crossing 12 active points sets banUntilRound and wipes contributing entries', () => {
    const world = initializeGame('mclaren', 'golden-era', 1)
    const activeIds = world.drivers
      .filter(d => d.teamId && !d.isReserve && !d.isF2)
      .map(d => d.id)
    const focusId = activeIds[0]

    // Pre-seed 11 active penalty points on this driver (all in current season/round window)
    const existingEntries: PenaltyPointEntry[] = Array.from({ length: 11 }, (_, i) => ({
      points: 1,
      issuedSeason: 2026,
      issuedRound: i + 1,        // rounds 1-11 (all within the 22-round window)
      offenceType: 'collision-minor' as const,
      raceId: `r${i + 1}`,
    }))

    const seededDrivers = world.drivers.map(d =>
      d.id === focusId ? { ...d, penaltyPoints: existingEntries } : d,
    )

    // Race round 12: add a 2-point penalty → total 13 ≥ 12 threshold
    const results = buildResults(activeIds, focusId, [TWO_POINT_PENALTY])

    const update = processPostRace(
      world.teams, seededDrivers, world.finance,
      [], {}, results, null, false,
      12, 2026,
      'mclaren', world.gameState.totalRaces, world.boardExpectations, createPRNG(44),
    )

    const driver = update.drivers.find(d => d.id === focusId)!
    expect(driver.banUntilRound).toBe(12 + DEFAULT_PENALTY_CALIBRATION.banDurationRounds)
    // After wiping contributing entries, total active points must be < banThreshold
    const remainingSum = driver.penaltyPoints.reduce((s, e) => s + e.points, 0)
    expect(remainingSum).toBeLessThan(DEFAULT_PENALTY_CALIBRATION.banThreshold)
  })

  it('crossing 5 warnings sets nextRaceGridDrop=10 and resets warningsThisSeason', () => {
    const world = initializeGame('mclaren', 'golden-era', 1)
    const activeIds = world.drivers
      .filter(d => d.teamId && !d.isReserve && !d.isF2)
      .map(d => d.id)
    const focusId = activeIds[0]

    // Pre-seed 4 warnings so this race tips over threshold (5)
    const seededDrivers = world.drivers.map(d =>
      d.id === focusId ? { ...d, warningsThisSeason: 4 } : d,
    )

    const results = buildResults(activeIds, focusId, [MINOR_PENALTY]) // warningCounted: true

    const update = processPostRace(
      world.teams, seededDrivers, world.finance,
      [], {}, results, null, false,
      1, 2026,
      'mclaren', world.gameState.totalRaces, world.boardExpectations, createPRNG(45),
    )

    const driver = update.drivers.find(d => d.id === focusId)!
    expect(driver.nextRaceGridDrop).toBe(DEFAULT_PENALTY_CALIBRATION.warningGridDrop) // 10
    expect(driver.warningsThisSeason).toBe(0)
  })

  it('a driver whose banUntilRound === currentRound has it cleared at the start', () => {
    const world = initializeGame('mclaren', 'golden-era', 1)
    const activeIds = world.drivers
      .filter(d => d.teamId && !d.isReserve && !d.isF2)
      .map(d => d.id)
    const focusId = activeIds[0]

    // Pre-seed a ban that expires on round 5
    const seededDrivers = world.drivers.map(d =>
      d.id === focusId ? { ...d, banUntilRound: 5 } : d,
    )

    const results = buildResults(activeIds, focusId, [])

    const update = processPostRace(
      world.teams, seededDrivers, world.finance,
      [], {}, results, null, false,
      5, 2026, // currentRound === banUntilRound
      'mclaren', world.gameState.totalRaces, world.boardExpectations, createPRNG(46),
    )

    const driver = update.drivers.find(d => d.id === focusId)!
    expect(driver.banUntilRound).toBeNull()
  })

  it('ban is NOT cleared when currentRound < banUntilRound', () => {
    const world = initializeGame('mclaren', 'golden-era', 1)
    const activeIds = world.drivers
      .filter(d => d.teamId && !d.isReserve && !d.isF2)
      .map(d => d.id)
    const focusId = activeIds[0]

    const seededDrivers = world.drivers.map(d =>
      d.id === focusId ? { ...d, banUntilRound: 6 } : d,
    )

    const results = buildResults(activeIds, focusId, [])

    const update = processPostRace(
      world.teams, seededDrivers, world.finance,
      [], {}, results, null, false,
      5, 2026, // currentRound < banUntilRound — should NOT clear
      'mclaren', world.gameState.totalRaces, world.boardExpectations, createPRNG(47),
    )

    const driver = update.drivers.find(d => d.id === focusId)!
    expect(driver.banUntilRound).toBe(6)
  })

  it('idempotency guard: re-fire with same currentRound does not double-count penalties', () => {
    const world = initializeGame('mclaren', 'golden-era', 1)
    const activeIds = world.drivers
      .filter(d => d.teamId && !d.isReserve && !d.isF2)
      .map(d => d.id)
    const focusId = activeIds[0]

    const results = buildResults(activeIds, focusId, [MINOR_PENALTY])

    const firstPass = processPostRace(
      world.teams, world.drivers, world.finance,
      [], {}, results, null, false,
      1, 2026,
      'mclaren', world.gameState.totalRaces, world.boardExpectations, createPRNG(48),
    )

    const secondPass = processPostRace(
      firstPass.teams, firstPass.drivers, firstPass.finance,
      firstPass.narrativeEvents, firstPass.eventCooldowns,
      results, null, false,
      1, 2026, // same round — idempotency guard must fire
      'mclaren', world.gameState.totalRaces, world.boardExpectations, createPRNG(48),
    )

    const first = firstPass.drivers.find(d => d.id === focusId)!
    const second = secondPass.drivers.find(d => d.id === focusId)!
    expect(second.seasonStats.penalties).toBe(first.seasonStats.penalties)
    expect(second.penaltyPoints).toHaveLength(first.penaltyPoints.length)
    expect(second.warningsThisSeason).toBe(first.warningsThisSeason)
  })

  it('penalty point entries expire after the rolling window', () => {
    const world = initializeGame('mclaren', 'golden-era', 1)
    const activeIds = world.drivers
      .filter(d => d.teamId && !d.isReserve && !d.isF2)
      .map(d => d.id)
    const focusId = activeIds[0]

    // Issue a penalty at season 2026, round 1
    const oldEntry: PenaltyPointEntry = {
      points: 2,
      issuedSeason: 2026,
      issuedRound: 1,
      offenceType: 'collision-minor',
      raceId: 'r1',
    }
    const seededDrivers = world.drivers.map(d =>
      d.id === focusId ? { ...d, penaltyPoints: [oldEntry] } : d,
    )

    // Now process round 23 of next season — age = 1*22 + (1-1) = 22 rounds >= window (22)
    const results = buildResults(activeIds, focusId, [])

    const update = processPostRace(
      world.teams, seededDrivers, world.finance,
      [], {}, results, null, false,
      1, 2027,  // one full season later → age === 22 → entry expires
      'mclaren', world.gameState.totalRaces, world.boardExpectations, createPRNG(49),
    )

    const driver = update.drivers.find(d => d.id === focusId)!
    // The entry issued at 2026/R1 should have been expired when processing 2027/R1
    // (age = (2027-2026)*22 + (1-1) = 22 >= 22 → filtered out)
    const hasOld = driver.penaltyPoints.some(
      e => e.issuedSeason === 2026 && e.issuedRound === 1,
    )
    expect(hasOld).toBe(false)
  })
})
