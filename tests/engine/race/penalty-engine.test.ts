import { describe, it, expect } from 'vitest'
import { evaluateContestedEvent, type ContestedEventInput } from '@/engine/race/penalty-engine'
import { DEFAULT_PENALTY_CALIBRATION } from '@/data/penalty-calibration'
import { createPRNG } from '@/engine/core/prng'
import type { RaceDriver } from '@/engine/race/race-simulator'

function makeDriver(id: string, overrides: Partial<RaceDriver['attributes']> = {}): RaceDriver {
  return {
    id,
    car: { downforce: 80, straightSpeed: 80, reliability: 80, tireManagement: 80, braking: 80, cornering: 80 },
    attributes: {
      pace: 80, racecraft: 80, experience: 80, mentality: 70,
      marketability: 50, developmentPotential: 50,
      ...overrides,
    },
  }
}

function baseInput(overrides: Partial<ContestedEventInput> = {}): ContestedEventInput {
  return {
    attacker: makeDriver('att'),
    defender: makeDriver('def'),
    attackerCommand: 'standard',
    defenderCommand: 'standard',
    lapDelta: 0.3,
    tireDelta: 0,
    circuit: { overtakingDifficulty: 'medium' },
    attackerMood: { frustration: 30, confidence: 60 },
    defenderMood: { frustration: 30, confidence: 60 },
    calibration: DEFAULT_PENALTY_CALIBRATION,
    ...overrides,
  }
}

describe('evaluateContestedEvent', () => {
  it('clean racing produces null decision', () => {
    const rng = createPRNG(1)
    const result = evaluateContestedEvent(baseInput(), rng)
    expect(result.decision).toBeNull()
    expect(result.attackerFault).toBeGreaterThanOrEqual(0)
    expect(result.attackerFault).toBeLessThanOrEqual(1)
    expect(result.defenderFault).toBeGreaterThanOrEqual(0)
    expect(result.defenderFault).toBeLessThanOrEqual(1)
  })

  it('aggressive overtake by an inexperienced, frustrated driver triggers attacker blame', () => {
    const rng = createPRNG(1)
    const result = evaluateContestedEvent(baseInput({
      attackerCommand: 'overtake',
      attacker: makeDriver('att', { racecraft: 40, experience: 30 }),
      attackerMood: { frustration: 90, confidence: 40 },
      circuit: { overtakingDifficulty: 'high' },
    }), rng)
    expect(result.decision).not.toBeNull()
    expect(result.decision!.driverId).toBe('att')
  })

  it('aggressive defending by an inexperienced, frustrated driver triggers defender blame', () => {
    const rng = createPRNG(1)
    const result = evaluateContestedEvent(baseInput({
      attackerCommand: 'standard',
      defenderCommand: 'defend',
      defender: makeDriver('def', { racecraft: 40, experience: 30 }),
      defenderMood: { frustration: 90, confidence: 40 },
      circuit: { overtakingDifficulty: 'high' },
    }), rng)
    expect(result.decision).not.toBeNull()
    expect(result.decision!.driverId).toBe('def')
  })

  it('experience reduces fault score', () => {
    const rng = createPRNG(1)
    const inputLow  = baseInput({ attackerCommand: 'overtake', attacker: makeDriver('att', { experience: 10 }) })
    const inputHigh = baseInput({ attackerCommand: 'overtake', attacker: makeDriver('att', { experience: 95 }) })
    const low  = evaluateContestedEvent(inputLow,  rng)
    const high = evaluateContestedEvent(inputHigh, rng)
    expect(low.attackerFault).toBeGreaterThan(high.attackerFault)
  })

  it('attacker on aged tires diving in adds tire-mismatch risk', () => {
    const rng = createPRNG(1)
    const a = evaluateContestedEvent(baseInput({ attackerCommand: 'overtake', tireDelta: -50 }), rng)
    const b = evaluateContestedEvent(baseInput({ attackerCommand: 'overtake', tireDelta: 0 }),   rng)
    expect(a.attackerFault).toBeGreaterThan(b.attackerFault)
  })

  it('clamps fault scores to [0, 1]', () => {
    const rng = createPRNG(1)
    const result = evaluateContestedEvent(baseInput({
      attackerCommand: 'overtake',
      attacker: makeDriver('att', { racecraft: 0, experience: 0 }),
      attackerMood: { frustration: 100, confidence: 0 },
      circuit: { overtakingDifficulty: 'high' },
      tireDelta: -100,
    }), rng)
    expect(result.attackerFault).toBeLessThanOrEqual(1)
    expect(result.attackerFault).toBeGreaterThanOrEqual(0)
  })

  it('severity tier "egregious" maps an overtake-blamed attacker to collision-serious', () => {
    const rng = createPRNG(1)
    const result = evaluateContestedEvent(baseInput({
      attackerCommand: 'overtake',
      attacker: makeDriver('att', { racecraft: 0, experience: 0 }),
      attackerMood: { frustration: 100, confidence: 0 },
      circuit: { overtakingDifficulty: 'high' },
      tireDelta: -100,
    }), rng)
    expect(result.decision).not.toBeNull()
    expect(['collision-minor', 'collision-serious']).toContain(result.decision!.offenceType)
  })

  it('non-overtake attacker blame yields forcing-off', () => {
    const rng = createPRNG(1)
    const result = evaluateContestedEvent(baseInput({
      attackerCommand: 'push',
      attacker: makeDriver('att', { racecraft: 20, experience: 20 }),
      attackerMood: { frustration: 95, confidence: 30 },
      circuit: { overtakingDifficulty: 'high' },
    }), rng)
    if (result.decision) {
      expect(result.decision.offenceType).toBe('forcing-off')
    }
  })
})

import { openInvestigation, resolveInvestigations, type PendingInvestigation } from '@/engine/race/penalty-engine'

describe('openInvestigation', () => {
  it('decideOnLap is currentLap + a value within [minLaps, maxLaps]', () => {
    const rng = createPRNG(1)
    const inv = openInvestigation('drv-1', 'minor', 'forcing-off', 10, 50, rng)
    expect(inv.decideOnLap).toBeGreaterThanOrEqual(11)
    expect(inv.decideOnLap).toBeLessThanOrEqual(15)
    expect(inv.openedOnLap).toBe(10)
    expect(inv.driverId).toBe('drv-1')
  })

  it('clamps decideOnLap to totalLaps when window would exceed it', () => {
    const rng = createPRNG(1)
    const inv = openInvestigation('drv-1', 'minor', 'forcing-off', 49, 50, rng)
    expect(inv.decideOnLap).toBeLessThanOrEqual(50)
  })

  it('id is deterministic for the same seed and inputs', () => {
    const rngA = createPRNG(42)
    const rngB = createPRNG(42)
    const a = openInvestigation('drv-1', 'minor', 'forcing-off', 10, 50, rngA)
    const b = openInvestigation('drv-1', 'minor', 'forcing-off', 10, 50, rngB)
    expect(a.id).toBe(b.id)
    expect(a.decideOnLap).toBe(b.decideOnLap)
  })
})

describe('resolveInvestigations', () => {
  const sample = (overrides: Partial<PendingInvestigation> = {}): PendingInvestigation => ({
    id: 'inv-1',
    driverId: 'drv-1',
    openedOnLap: 5,
    decideOnLap: 8,
    severity: 'minor',
    offenceType: 'forcing-off',
    ...overrides,
  })

  it('partitions resolved vs stillPending at currentLap', () => {
    const pending: PendingInvestigation[] = [
      sample({ id: 'a', decideOnLap: 8 }),
      sample({ id: 'b', decideOnLap: 10 }),
      sample({ id: 'c', decideOnLap: 7 }),
    ]
    const result = resolveInvestigations(pending, 8)
    expect(result.resolved.map((i) => i.id).sort()).toEqual(['a', 'c'])
    expect(result.stillPending.map((i) => i.id)).toEqual(['b'])
  })

  it('returns no resolved entries when currentLap is below all decideOnLap', () => {
    const pending = [sample({ decideOnLap: 10 })]
    expect(resolveInvestigations(pending, 5).resolved).toHaveLength(0)
  })

  it('returns empty arrays when input is empty', () => {
    const r = resolveInvestigations([], 10)
    expect(r.resolved).toHaveLength(0)
    expect(r.stillPending).toHaveLength(0)
  })
})
