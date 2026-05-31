import { describe, it, expect } from 'vitest'
import { createPRNG } from '@/engine/core/prng'
import {
  mixSeed,
  evaluateCrash,
  evaluateMechanical,
  rollLapIncidents,
  cautionFromIncidents,
  DEFAULT_RACE_INCIDENT_CONFIG,
  type RaceIncidentConfig,
  type IncidentRoll,
} from '@/engine/race/race-incidents'

describe('mixSeed', () => {
  it('is deterministic for the same (raceSeed, lap)', () => {
    expect(mixSeed(1000, 7)).toBe(mixSeed(1000, 7))
  })

  it('produces a 32-bit integer', () => {
    const s = mixSeed(1000, 7)
    expect(Number.isInteger(s)).toBe(true)
    expect(s).toBe(s | 0)
  })

  it('changes with the lap (so each lap gets its own incident PRNG)', () => {
    expect(mixSeed(1000, 1)).not.toBe(mixSeed(1000, 2))
  })

  it('changes with the race seed', () => {
    expect(mixSeed(1000, 1)).not.toBe(mixSeed(1001, 1))
  })
})

function crashInput(over: Partial<{ racecraft: number; experience: number; frustration: number; wet: boolean; circuitRiskFactor: number; config: RaceIncidentConfig }> = {}) {
  return {
    driverId: 'd1',
    racecraft: over.racecraft ?? 60,
    experience: over.experience ?? 70,
    frustration: over.frustration ?? 40,
    wet: over.wet ?? false,
    circuitRiskFactor: over.circuitRiskFactor ?? 1,
    config: over.config ?? DEFAULT_RACE_INCIDENT_CONFIG,
  }
}

/** Count crash hits across a seed sweep (each seed = an independent per-lap roll). */
function crashHits(input: ReturnType<typeof crashInput>, seeds = 4000): number {
  let hits = 0
  for (let s = 1; s <= seeds; s++) {
    if (evaluateCrash(input, createPRNG(s)) !== null) hits++
  }
  return hits
}

describe('evaluateCrash', () => {
  it('is deterministic for a fixed input + seed', () => {
    const a = evaluateCrash(crashInput(), createPRNG(123))
    const b = evaluateCrash(crashInput(), createPRNG(123))
    expect(a).toEqual(b)
  })

  it('returns null on a no-hit roll and a retiring roll on a hit', () => {
    // Base hazard clamps to MAX_INCIDENT_HAZARD (0.5); seed 7's first draw (~0.012)
    // is below it, so this seed reliably hits. Verify the hit shape.
    const cfg: RaceIncidentConfig = { ...DEFAULT_RACE_INCIDENT_CONFIG, crashBaseHazard: 0.9 }
    const roll = evaluateCrash(crashInput({ config: cfg }), createPRNG(7))
    expect(roll).not.toBeNull()
    expect(roll!.kind).toBe('crash')
    expect(roll!.retired).toBe(true)
  })

  it('a heavy shunt is always caution-worthy with major severity', () => {
    // crashMajorShare = 1 → every hit is a major heavy shunt.
    const cfg: RaceIncidentConfig = { ...DEFAULT_RACE_INCIDENT_CONFIG, crashBaseHazard: 0.9, crashMajorShare: 1 }
    const roll = evaluateCrash(crashInput({ config: cfg }), createPRNG(7))
    expect(roll!.cautionWorthy).toBe(true)
    expect(roll!.cautionSeverity).toBe('major')
  })

  it('a non-major non-caution crash is a retirement with no caution', () => {
    // No major, no minor caution → retired but not caution-worthy.
    const cfg: RaceIncidentConfig = { ...DEFAULT_RACE_INCIDENT_CONFIG, crashBaseHazard: 0.9, crashMajorShare: 0, crashCautionShare: 0 }
    const roll = evaluateCrash(crashInput({ config: cfg }), createPRNG(7))
    expect(roll!.retired).toBe(true)
    expect(roll!.cautionWorthy).toBe(false)
    expect(roll!.cautionSeverity).toBeNull()
  })

  it('lower racecraft crashes more often', () => {
    expect(crashHits(crashInput({ racecraft: 20 }))).toBeGreaterThan(crashHits(crashInput({ racecraft: 95 })))
  })

  it('higher frustration crashes more often', () => {
    // Frustration spans a narrow factor (1.025→1.475); raise the base hazard so the
    // monotonic effect produces a statistically reliable gap over the seed sweep
    // (frustration stays the only variable).
    const cfg: RaceIncidentConfig = { ...DEFAULT_RACE_INCIDENT_CONFIG, crashBaseHazard: 0.02 }
    expect(crashHits(crashInput({ frustration: 95, config: cfg }))).toBeGreaterThan(crashHits(crashInput({ frustration: 5, config: cfg })))
  })

  it('wet weather crashes more often', () => {
    expect(crashHits(crashInput({ wet: true }))).toBeGreaterThan(crashHits(crashInput({ wet: false })))
  })
})

function mechInput(over: Partial<{ reliability: number; lapFraction: number; config: RaceIncidentConfig }> = {}) {
  return {
    driverId: 'd1',
    reliability: over.reliability ?? 80,
    lapFraction: over.lapFraction ?? 0.5,
    config: over.config ?? DEFAULT_RACE_INCIDENT_CONFIG,
  }
}

function mechHits(input: ReturnType<typeof mechInput>, seeds = 4000): number {
  let hits = 0
  for (let s = 1; s <= seeds; s++) {
    if (evaluateMechanical(input, createPRNG(s)) !== null) hits++
  }
  return hits
}

describe('evaluateMechanical', () => {
  it('is deterministic for a fixed input + seed', () => {
    expect(evaluateMechanical(mechInput(), createPRNG(50))).toEqual(evaluateMechanical(mechInput(), createPRNG(50)))
  })

  it('a hit retires the car and any caution it raises is minor', () => {
    const cfg: RaceIncidentConfig = { ...DEFAULT_RACE_INCIDENT_CONFIG, mechanicalBaseHazard: 0.9, mechanicalCautionShare: 1 }
    const roll = evaluateMechanical(mechInput({ config: cfg }), createPRNG(7))
    expect(roll!.kind).toBe('mechanical')
    expect(roll!.retired).toBe(true)
    expect(roll!.cautionWorthy).toBe(true)
    expect(roll!.cautionSeverity).toBe('minor') // never 'major'
  })

  it('a non-caution mechanical retires without a caution', () => {
    const cfg: RaceIncidentConfig = { ...DEFAULT_RACE_INCIDENT_CONFIG, mechanicalBaseHazard: 0.9, mechanicalCautionShare: 0 }
    const roll = evaluateMechanical(mechInput({ config: cfg }), createPRNG(7))
    expect(roll!.retired).toBe(true)
    expect(roll!.cautionWorthy).toBe(false)
    expect(roll!.cautionSeverity).toBeNull()
  })

  it('lower reliability fails more often', () => {
    // Raise the base hazard so the monotonic reliability effect produces a
    // statistically reliable gap over the seed sweep (reliability stays the only variable).
    const cfg: RaceIncidentConfig = { ...DEFAULT_RACE_INCIDENT_CONFIG, mechanicalBaseHazard: 0.02 }
    expect(mechHits(mechInput({ reliability: 40, config: cfg }))).toBeGreaterThan(mechHits(mechInput({ reliability: 95, config: cfg })))
  })

  it('later in the race fails more often', () => {
    // Raise the base hazard so the monotonic lap-fraction (wear) effect produces a
    // statistically reliable gap over the seed sweep (lapFraction stays the only variable).
    const cfg: RaceIncidentConfig = { ...DEFAULT_RACE_INCIDENT_CONFIG, mechanicalBaseHazard: 0.02 }
    expect(mechHits(mechInput({ lapFraction: 0.95, config: cfg }))).toBeGreaterThan(mechHits(mechInput({ lapFraction: 0.05, config: cfg })))
  })
})

function field() {
  return [
    { id: 'd3', racecraft: 40, experience: 40, frustration: 80, reliability: 50 },
    { id: 'd1', racecraft: 40, experience: 40, frustration: 80, reliability: 50 },
    { id: 'd2', racecraft: 40, experience: 40, frustration: 80, reliability: 50 },
  ]
}

describe('rollLapIncidents', () => {
  it('is deterministic for the same input + seed', () => {
    const input = { drivers: field(), dnfDriverIds: {}, currentLap: 10, totalLaps: 50, wet: false, circuitRiskFactor: 1, config: DEFAULT_RACE_INCIDENT_CONFIG }
    expect(rollLapIncidents(input, createPRNG(9))).toEqual(rollLapIncidents(input, createPRNG(9)))
  })

  it('skips drivers already in dnfDriverIds', () => {
    // High crash hazard + a hitting seed: d1's crash draw lands (seed 7's first
    // draw ~0.012 is below the 0.5 hazard clamp), so d1 produces a roll while the
    // pre-retired d2 is skipped structurally.
    const cfg: RaceIncidentConfig = { ...DEFAULT_RACE_INCIDENT_CONFIG, crashBaseHazard: 0.99 }
    const input = { drivers: field(), dnfDriverIds: { d2: true as const }, currentLap: 10, totalLaps: 50, wet: false, circuitRiskFactor: 1, config: cfg }
    const rolls = rollLapIncidents(input, createPRNG(7))
    expect(rolls.some((r) => r.driverId === 'd2')).toBe(false)
    expect(rolls.some((r) => r.driverId === 'd1')).toBe(true)
  })

  it('processes drivers in sorted id order (deterministic draw order)', () => {
    // Same field in two different array orders → identical rolls (proves the
    // function sorts internally rather than depending on array order).
    const a = rollLapIncidents({ drivers: field(), dnfDriverIds: {}, currentLap: 10, totalLaps: 50, wet: false, circuitRiskFactor: 1, config: { ...DEFAULT_RACE_INCIDENT_CONFIG, crashBaseHazard: 0.5 } }, createPRNG(3))
    const reordered = [...field()].reverse()
    const b = rollLapIncidents({ drivers: reordered, dnfDriverIds: {}, currentLap: 10, totalLaps: 50, wet: false, circuitRiskFactor: 1, config: { ...DEFAULT_RACE_INCIDENT_CONFIG, crashBaseHazard: 0.5 } }, createPRNG(3))
    expect(a).toEqual(b)
  })
})

describe('cautionFromIncidents', () => {
  const roll = (over: Partial<IncidentRoll>): IncidentRoll => ({ driverId: 'd1', kind: 'crash', retired: true, cautionWorthy: false, cautionSeverity: null, ...over })

  it('returns null for no rolls', () => {
    expect(cautionFromIncidents([])).toBeNull()
  })

  it('returns null when no roll is caution-worthy', () => {
    expect(cautionFromIncidents([roll({ cautionWorthy: false })])).toBeNull()
  })

  it('returns minor when the only worthy incidents are minor', () => {
    expect(cautionFromIncidents([roll({ cautionWorthy: true, cautionSeverity: 'minor' })])).toBe('minor')
  })

  it('returns major when any worthy incident is major', () => {
    expect(cautionFromIncidents([
      roll({ cautionWorthy: true, cautionSeverity: 'minor' }),
      roll({ driverId: 'd2', cautionWorthy: true, cautionSeverity: 'major' }),
    ])).toBe('major')
  })
})
