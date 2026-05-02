import { describe, it, expect } from 'vitest'
import type { Team, RndUpgrade } from '@/types/team'
import {
  consumeAeroBudget,
  resetAeroWindow,
  snapshotUpgradePrediction,
  measureUpgradeOutcome,
  correlationDeltaFromOutcomes,
  AERO_BOOKINGS_CAP,
  UPGRADE_OUTCOMES_CAP,
} from '@/engine/engineering/aero-budget'

function makeUpgrade(overrides: Partial<RndUpgrade> = {}): RndUpgrade {
  return {
    id: 'aero-x', branch: 'active-aero',
    name: 'X', description: '',
    progress: 0, status: 'in-progress',
    cost: 1_000_000, developmentRaces: 3,
    performanceDelta: { downforce: 3, cornering: 2 },
    prerequisiteIds: [],
    wtHoursPerCycle: 10, cfdRunsPerCycle: 50,
    ...overrides,
  }
}

function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 'mclaren', name: 'McLaren', shortName: 'MCL',
    color: '#FF8000', headquarters: 'Woking', powerUnitSupplier: 'mercedes',
    driverIds: ['norris', 'piastri'], reserveDriverId: null, staff: [],
    car: { downforce: 80, straightSpeed: 80, reliability: 80, tireManagement: 80, braking: 80, cornering: 80 },
    rndUpgrades: [],
    components: [
      { element: 'ice', used: 0, limit: 4, failureProbability: 0.02 },
      { element: 'turbo', used: 0, limit: 4, failureProbability: 0.02 },
      { element: 'mgu-k', used: 0, limit: 4, failureProbability: 0.02 },
      { element: 'ers-battery', used: 0, limit: 3, failureProbability: 0.01 },
      { element: 'gearbox', used: 0, limit: 4, failureProbability: 0.02 },
    ],
    windTunnelHoursUsed: 0, windTunnelHoursLimit: 100,
    cfdRunsUsed: 0, cfdRunsLimit: 500,
    morale: 80, aiPersonality: null,
    constructorPoints: 0, constructorPosition: 5,
    previousConstructorPosition: 0, previousMorale: 80,
    seasonForm: [], lastProcessedRound: 0,
    ovrHistory: [], lastUpgradeRound: 0,
    fastestLapHistory: [], failureEvents: [],
    penaltiesTaken: 0, pendingComponentSwaps: [],
    aeroBookings: [], upgradeOutcomes: [],
    pitCrewChief: null,
    pitCrewMembers: [],
    ...overrides,
  }
}

describe('consumeAeroBudget', () => {
  it('appends a zero-spend booking on idle cycles and never stalls', () => {
    const team = makeTeam({
      rndUpgrades: [makeUpgrade({ id: 'aero-x', status: 'available' })],
    })
    const result = consumeAeroBudget(team, 0)
    expect(result.stalledUpgradeIds).toEqual([])
    expect(result.team.windTunnelHoursUsed).toBe(0)
    expect(result.team.cfdRunsUsed).toBe(0)
    // Spec §4.3: ledger is appended every management cycle, even when no
    // aero work runs. Zero-spend entries render as gaps in the histogram.
    expect(result.team.aeroBookings).toEqual([{ day: 0, wtHours: 0, cfdRuns: 0 }])
  })

  it('deducts wtHoursPerCycle and cfdRunsPerCycle for each in-progress upgrade', () => {
    const team = makeTeam({
      rndUpgrades: [
        makeUpgrade({ id: 'aero-a', wtHoursPerCycle: 10, cfdRunsPerCycle: 50 }),
        makeUpgrade({ id: 'aero-b', wtHoursPerCycle: 5, cfdRunsPerCycle: 25 }),
      ],
    })
    const result = consumeAeroBudget(team, 3)
    expect(result.team.windTunnelHoursUsed).toBe(15)
    expect(result.team.cfdRunsUsed).toBe(75)
    expect(result.stalledUpgradeIds).toEqual([])
  })

  it('appends one booking per cycle reflecting actual spend', () => {
    const team = makeTeam({
      rndUpgrades: [makeUpgrade({ wtHoursPerCycle: 7, cfdRunsPerCycle: 33 })],
    })
    const result = consumeAeroBudget(team, 2)
    expect(result.team.aeroBookings).toHaveLength(1)
    expect(result.team.aeroBookings[0]).toEqual({ day: 2, wtHours: 7, cfdRuns: 33 })
  })

  it('FIFO-trims aeroBookings to AERO_BOOKINGS_CAP entries', () => {
    const seed = Array.from({ length: AERO_BOOKINGS_CAP }, (_, i) => ({
      day: i, wtHours: 1, cfdRuns: 5,
    }))
    const team = makeTeam({
      aeroBookings: seed,
      rndUpgrades: [makeUpgrade({ wtHoursPerCycle: 2, cfdRunsPerCycle: 10 })],
    })
    const result = consumeAeroBudget(team, 13)
    expect(result.team.aeroBookings).toHaveLength(AERO_BOOKINGS_CAP)
    expect(result.team.aeroBookings[0]).toEqual({ day: 1, wtHours: 1, cfdRuns: 5 })
    expect(result.team.aeroBookings.at(-1)).toEqual({ day: 13, wtHours: 2, cfdRuns: 10 })
  })

  it('stalls upgrades whose deduction would push WT used > limit', () => {
    const team = makeTeam({
      windTunnelHoursUsed: 95, windTunnelHoursLimit: 100,
      rndUpgrades: [makeUpgrade({ id: 'aero-big', wtHoursPerCycle: 10, cfdRunsPerCycle: 50 })],
    })
    const result = consumeAeroBudget(team, 0)
    expect(result.stalledUpgradeIds).toEqual(['aero-big'])
    expect(result.team.windTunnelHoursUsed).toBe(95)
    expect(result.team.aeroBookings[0]).toEqual({ day: 0, wtHours: 0, cfdRuns: 0 })
  })

  it('stalls upgrades whose deduction would push CFD used > limit', () => {
    const team = makeTeam({
      cfdRunsUsed: 480, cfdRunsLimit: 500,
      rndUpgrades: [makeUpgrade({ id: 'aero-cfd-heavy', wtHoursPerCycle: 1, cfdRunsPerCycle: 30 })],
    })
    const result = consumeAeroBudget(team, 0)
    expect(result.stalledUpgradeIds).toEqual(['aero-cfd-heavy'])
    expect(result.team.cfdRunsUsed).toBe(480)
  })

  it('processes upgrades in lexical id order; once one stalls, every later one stalls regardless of fit', () => {
    const team = makeTeam({
      windTunnelHoursUsed: 80, windTunnelHoursLimit: 100,
      rndUpgrades: [
        // Order in array is reverse-lexical; processing must be by lex-asc id.
        makeUpgrade({ id: 'aero-c', wtHoursPerCycle: 1, cfdRunsPerCycle: 5 }),
        makeUpgrade({ id: 'aero-b-overflow', wtHoursPerCycle: 30, cfdRunsPerCycle: 5 }),
        makeUpgrade({ id: 'aero-a', wtHoursPerCycle: 5, cfdRunsPerCycle: 5 }),
      ],
    })
    const result = consumeAeroBudget(team, 0)
    // 'aero-a' fits (80 + 5 = 85). 'aero-b-overflow' would push to 115 → stall.
    // 'aero-c' individually fits but is later in order → also stalls.
    expect(result.stalledUpgradeIds).toEqual(['aero-b-overflow', 'aero-c'])
    expect(result.team.windTunnelHoursUsed).toBe(85)
  })

  it('determinism: same input yields same output across calls', () => {
    const team = makeTeam({
      rndUpgrades: [
        makeUpgrade({ id: 'aero-a', wtHoursPerCycle: 4, cfdRunsPerCycle: 20 }),
        makeUpgrade({ id: 'aero-b', wtHoursPerCycle: 3, cfdRunsPerCycle: 15 }),
      ],
    })
    const a = consumeAeroBudget(team, 5)
    const b = consumeAeroBudget(team, 5)
    expect(a).toEqual(b)
  })

  it('only counts upgrades with status === in-progress', () => {
    const team = makeTeam({
      rndUpgrades: [
        makeUpgrade({ id: 'aero-a', status: 'available', wtHoursPerCycle: 99, cfdRunsPerCycle: 999 }),
        makeUpgrade({ id: 'aero-b', status: 'queued', wtHoursPerCycle: 99, cfdRunsPerCycle: 999 }),
        makeUpgrade({ id: 'aero-c', status: 'complete', wtHoursPerCycle: 99, cfdRunsPerCycle: 999 }),
        makeUpgrade({ id: 'aero-d', status: 'in-progress', wtHoursPerCycle: 5, cfdRunsPerCycle: 25 }),
      ],
    })
    const result = consumeAeroBudget(team, 0)
    expect(result.team.windTunnelHoursUsed).toBe(5)
    expect(result.team.cfdRunsUsed).toBe(25)
  })
})

describe('resetAeroWindow', () => {
  it('zeroes used counters and clears the booking ledger', () => {
    const team = makeTeam({
      windTunnelHoursUsed: 87, cfdRunsUsed: 432,
      aeroBookings: [{ day: 0, wtHours: 2, cfdRuns: 10 }, { day: 1, wtHours: 3, cfdRuns: 20 }],
    })
    const next = resetAeroWindow(team)
    expect(next.windTunnelHoursUsed).toBe(0)
    expect(next.cfdRunsUsed).toBe(0)
    expect(next.aeroBookings).toEqual([])
  })

  it('preserves limit fields and unrelated state', () => {
    const team = makeTeam({
      windTunnelHoursLimit: 250, cfdRunsLimit: 1800,
      rndUpgrades: [makeUpgrade({ id: 'keep-me' })],
    })
    const next = resetAeroWindow(team)
    expect(next.windTunnelHoursLimit).toBe(250)
    expect(next.cfdRunsLimit).toBe(1800)
    expect(next.rndUpgrades).toEqual(team.rndUpgrades)
  })
})

describe('snapshotUpgradePrediction', () => {
  it('returns an outcome with predictedOvrDelta as the sum of performanceDelta values', () => {
    const team = makeTeam({
      rndUpgrades: [
        makeUpgrade({
          id: 'aero-x', status: 'complete',
          performanceDelta: { downforce: 3, cornering: 2, reliability: -1 },
        }),
      ],
    })
    const outcome = snapshotUpgradePrediction(team, 'aero-x', 5)
    expect(outcome).not.toBeNull()
    expect(outcome!.upgradeId).toBe('aero-x')
    expect(outcome!.deliveredRound).toBe(5)
    expect(outcome!.predictedOvrDelta).toBe(4) // 3 + 2 + (-1)
    expect(outcome!.actualOvrDelta).toBeNull()
  })

  it('captures the team OVR at delivery so the comparison has a stable baseline', () => {
    const team = makeTeam({
      car: { downforce: 90, straightSpeed: 90, reliability: 90, tireManagement: 90, braking: 90, cornering: 90 },
      rndUpgrades: [makeUpgrade({ id: 'aero-x', status: 'complete' })],
    })
    const outcome = snapshotUpgradePrediction(team, 'aero-x', 5)
    expect(outcome!.ovrAtDelivery).toBe(90)
  })

  it('returns null when the upgrade is not on the team', () => {
    const team = makeTeam({ rndUpgrades: [] })
    const outcome = snapshotUpgradePrediction(team, 'aero-missing', 5)
    expect(outcome).toBeNull()
  })

  it('handles empty performanceDelta as 0 prediction', () => {
    const team = makeTeam({
      rndUpgrades: [
        makeUpgrade({ id: 'aero-y', status: 'complete', performanceDelta: {} }),
      ],
    })
    const outcome = snapshotUpgradePrediction(team, 'aero-y', 1)
    expect(outcome!.predictedOvrDelta).toBe(0)
  })
})

describe('measureUpgradeOutcome', () => {
  it('fills actualOvrDelta on outcomes whose deliveredRound is < currentRound', () => {
    const team = makeTeam({
      car: { downforce: 90, straightSpeed: 90, reliability: 90, tireManagement: 90, braking: 90, cornering: 90 },
      upgradeOutcomes: [{
        upgradeId: 'aero-a', deliveredRound: 4,
        predictedOvrDelta: 5, ovrAtDelivery: 85, actualOvrDelta: null,
      }],
    })
    const next = measureUpgradeOutcome(team, 5)
    expect(next.upgradeOutcomes[0].actualOvrDelta).toBe(5) // 90 - 85
  })

  it('does not overwrite an outcome whose actualOvrDelta is already set', () => {
    const team = makeTeam({
      car: { downforce: 90, straightSpeed: 90, reliability: 90, tireManagement: 90, braking: 90, cornering: 90 },
      upgradeOutcomes: [{
        upgradeId: 'aero-a', deliveredRound: 4,
        predictedOvrDelta: 5, ovrAtDelivery: 85, actualOvrDelta: 7,
      }],
    })
    const next = measureUpgradeOutcome(team, 5)
    expect(next.upgradeOutcomes[0].actualOvrDelta).toBe(7)
  })

  it('does not measure when currentRound equals or precedes deliveredRound', () => {
    const team = makeTeam({
      car: { downforce: 90, straightSpeed: 90, reliability: 90, tireManagement: 90, braking: 90, cornering: 90 },
      upgradeOutcomes: [{
        upgradeId: 'aero-a', deliveredRound: 5,
        predictedOvrDelta: 5, ovrAtDelivery: 85, actualOvrDelta: null,
      }],
    })
    const next = measureUpgradeOutcome(team, 5)
    expect(next.upgradeOutcomes[0].actualOvrDelta).toBeNull()
  })

  it('returns the same team reference when nothing changes', () => {
    const team = makeTeam()
    expect(measureUpgradeOutcome(team, 5)).toBe(team)
  })
})

describe('correlationDeltaFromOutcomes', () => {
  it('falls back to hash-based heuristic when no measured outcomes exist', () => {
    const team = makeTeam({ upgradeOutcomes: [] })
    // Just confirms the value is bounded — exact hash is implementation detail.
    const value = correlationDeltaFromOutcomes(team, 7)
    expect(value).toBeGreaterThanOrEqual(-10)
    expect(value).toBeLessThanOrEqual(10)
  })

  it('averages percent deltas across measured outcomes', () => {
    const team = makeTeam({
      upgradeOutcomes: [
        // (6 - 5) / 5 = +20%
        { upgradeId: 'a', deliveredRound: 1, predictedOvrDelta: 5, ovrAtDelivery: 80, actualOvrDelta: 6 },
        // (4 - 5) / 5 = -20%
        { upgradeId: 'b', deliveredRound: 2, predictedOvrDelta: 5, ovrAtDelivery: 80, actualOvrDelta: 4 },
        // (5 - 5) / 5 = 0%
        { upgradeId: 'c', deliveredRound: 3, predictedOvrDelta: 5, ovrAtDelivery: 80, actualOvrDelta: 5 },
      ],
    })
    const value = correlationDeltaFromOutcomes(team, 4)
    expect(value).toBeCloseTo(0, 1)
  })

  it('clamps the averaged delta to ±10', () => {
    const team = makeTeam({
      upgradeOutcomes: [
        // (50 - 5) / 5 × 100 = 900% — should clamp to +10
        { upgradeId: 'a', deliveredRound: 1, predictedOvrDelta: 5, ovrAtDelivery: 80, actualOvrDelta: 50 },
      ],
    })
    expect(correlationDeltaFromOutcomes(team, 2)).toBe(10)
  })

  it('skips outcomes with predictedOvrDelta == 0 to avoid divide-by-zero', () => {
    const team = makeTeam({
      upgradeOutcomes: [
        { upgradeId: 'a', deliveredRound: 1, predictedOvrDelta: 0, ovrAtDelivery: 80, actualOvrDelta: 1 },
        { upgradeId: 'b', deliveredRound: 2, predictedOvrDelta: 5, ovrAtDelivery: 80, actualOvrDelta: 5 },
      ],
    })
    expect(correlationDeltaFromOutcomes(team, 3)).toBe(0)
  })

  it('skips outcomes whose actualOvrDelta is still null (not yet measured)', () => {
    const team = makeTeam({
      upgradeOutcomes: [
        { upgradeId: 'a', deliveredRound: 5, predictedOvrDelta: 5, ovrAtDelivery: 80, actualOvrDelta: null },
      ],
    })
    // Only unmeasured → fallback heuristic applies (bounded).
    const value = correlationDeltaFromOutcomes(team, 6)
    expect(value).toBeGreaterThanOrEqual(-10)
    expect(value).toBeLessThanOrEqual(10)
  })
})

describe('UPGRADE_OUTCOMES_CAP', () => {
  it('exposes the cap as a constant for reuse by callers', () => {
    expect(UPGRADE_OUTCOMES_CAP).toBeGreaterThan(0)
  })
})
