import { describe, it, expect, vi } from 'vitest'
import {
  runPracticeSession,
  simulateDriverProgram,
  applySessionToSetup,
  defaultDriverSetup,
  neutralDriverSetup,
  PROGRAM_COSTS,
  SKIP_SETUP_CONFIDENCE,
  SKIP_TIRE_DEG_READ,
  NEUTRAL_AI_SETUP,
} from '@/engine/practice/practice-engine'
import { createPRNG } from '@/engine/core/prng'
import type { CarPerformance } from '@/types/team'
import type { DriverAttributes } from '@/types/driver'
import type { DriverWeekendSetup, WeekendTireLedger, PracticeProgram } from '@/types/weekend'

const CAR: CarPerformance = {
  downforce: 75, straightSpeed: 75, reliability: 75,
  tireManagement: 75, braking: 75, cornering: 75,
}
const ATTR: DriverAttributes = {
  pace: 80, racecraft: 75, experience: 60, mentality: 70,
  marketability: 60, developmentPotential: 60,
}

function ledger(remaining: WeekendTireLedger['remaining']): WeekendTireLedger {
  return { remaining: { ...remaining } }
}

type PDriver = { id: string; car: CarPerformance; attributes: DriverAttributes; isPlayer: boolean }
const P1: PDriver = { id: 'p1', car: CAR, attributes: ATTR, isPlayer: true }
const P2: PDriver = { id: 'p2', car: CAR, attributes: ATTR, isPlayer: true }
const AI: PDriver = { id: 'ai1', car: CAR, attributes: ATTR, isPlayer: false }

function baseSetup(ids: string[]): Record<string, DriverWeekendSetup> {
  return Object.fromEntries(ids.map((id) => [id, defaultDriverSetup(id)]))
}

function runOne(opts: {
  sessionIndex?: 0 | 1 | 2
  program?: PracticeProgram
  compound?: string
  worldSeed?: number
  ledgerRemaining?: WeekendTireLedger['remaining']
  setup?: Record<string, DriverWeekendSetup>
  drivers?: PDriver[]
}) {
  const drivers = opts.drivers ?? [P1]
  return runPracticeSession({
    sessionIndex: opts.sessionIndex ?? 0,
    programByDriver: opts.program ? { p1: opts.program } : {},
    runCompoundByDriver: opts.compound ? { p1: opts.compound as never } : {},
    drivers: drivers as never,
    setup: opts.setup ?? baseSetup(drivers.map((d) => d.id)),
    ledger: ledger(opts.ledgerRemaining ?? { C3: 2, C4: 3, C5: 8 }),
    circuitId: 'monza',
    round: 5,
    season: 1,
    worldSeed: opts.worldSeed ?? 12345,
    completedAt: '2026-01-01T00:00:00.000Z',
  })
}

describe('defaults', () => {
  it('defaultDriverSetup is the skip baseline 35/30', () => {
    expect(defaultDriverSetup('x')).toEqual<DriverWeekendSetup>({
      driverId: 'x', setupConfidence: SKIP_SETUP_CONFIDENCE, tireDegRead: SKIP_TIRE_DEG_READ, sessionsCompleted: 0,
    })
    expect(SKIP_SETUP_CONFIDENCE).toBe(35)
    expect(SKIP_TIRE_DEG_READ).toBe(30)
  })
  it('neutralDriverSetup is the AI neutral 50/50', () => {
    expect(neutralDriverSetup('ai')).toEqual<DriverWeekendSetup>({
      driverId: 'ai', setupConfidence: NEUTRAL_AI_SETUP, tireDegRead: NEUTRAL_AI_SETUP, sessionsCompleted: 0,
    })
    expect(NEUTRAL_AI_SETUP).toBe(50)
  })
  it('program-cost table: setup-work is the cheapest in sets, tire-test the most', () => {
    expect(PROGRAM_COSTS['setup-work'].sets).toBeLessThanOrEqual(PROGRAM_COSTS['race-pace'].sets)
    expect(PROGRAM_COSTS['tire-test'].sets).toBe(
      Math.max(...Object.values(PROGRAM_COSTS).map((c) => c.sets)),
    )
  })
})

describe('runPracticeSession determinism', () => {
  it('is byte-identical across two runs with identical inputs', () => {
    const a = runOne({ program: 'setup-work', compound: 'C5' })
    const b = runOne({ program: 'setup-work', compound: 'C5' })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('FP1 and FP2 differ (distinct session salts)', () => {
    const fp1 = runOne({ sessionIndex: 0, program: 'setup-work', compound: 'C5' })
    const fp2 = runOne({ sessionIndex: 1, program: 'setup-work', compound: 'C5' })
    expect(fp1.result.driverResults[0].setupConfidenceDelta)
      .not.toBe(fp2.result.driverResults[0].setupConfidenceDelta)
  })

  it('different world seeds produce different results', () => {
    const s1 = runOne({ program: 'setup-work', compound: 'C5', worldSeed: 1 })
    const s2 = runOne({ program: 'setup-work', compound: 'C5', worldSeed: 2 })
    expect(s1.result.driverResults[0].setupConfidenceDelta)
      .not.toBe(s2.result.driverResults[0].setupConfidenceDelta)
  })

  it('makes no Math.random calls (seeded PRNG only)', () => {
    const spy = vi.spyOn(Math, 'random')
    runOne({ program: 'tire-test', compound: 'C5', drivers: [P1, P2, AI] })
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('skip / idle path', () => {
  it('an idle player driver (no program) accrues zero deltas and is not aborted', () => {
    const { result, nextSetup } = runOne({})
    const r = result.driverResults.find((d) => d.driverId === 'p1')!
    expect(r.program).toBeNull()
    expect(r.setupConfidenceDelta).toBe(0)
    expect(r.tireDegReadDelta).toBe(0)
    expect(r.sessionAborted).toBe(false)
    expect(nextSetup.p1).toEqual(defaultDriverSetup('p1')) // unchanged
  })
})

describe('tire-set ledger', () => {
  it('a player run decrements the chosen compound by the program set cost', () => {
    const { nextLedger, result } = runOne({ program: 'setup-work', compound: 'C5', ledgerRemaining: { C5: 8 } })
    expect(nextLedger.remaining.C5).toBe(8 - PROGRAM_COSTS['setup-work'].sets)
    expect(result.driverResults[0].setsConsumed.C5).toBe(PROGRAM_COSTS['setup-work'].sets)
    expect(result.driverResults[0].sessionAborted).toBe(false)
  })

  it('a run on a compound with insufficient sets aborts with zero deltas and no decrement', () => {
    const { nextLedger, result } = runOne({ program: 'tire-test', compound: 'C3', ledgerRemaining: { C3: 1, C5: 8 } })
    const r = result.driverResults[0]
    expect(r.sessionAborted).toBe(true) // tire-test needs >1 set; only 1 available
    expect(r.setupConfidenceDelta).toBe(0)
    expect(r.tireDegReadDelta).toBe(0)
    expect(nextLedger.remaining.C3).toBe(1) // untouched
  })

  it('AI drivers never decrement the player ledger and never accrue', () => {
    const { nextLedger, nextSetup, result } = runOne({
      program: 'setup-work', compound: 'C5',
      drivers: [P1, AI], setup: { p1: defaultDriverSetup('p1'), ai1: neutralDriverSetup('ai1') },
      ledgerRemaining: { C5: 8 },
    })
    expect(nextLedger.remaining.C5).toBe(8 - PROGRAM_COSTS['setup-work'].sets) // only p1 consumed
    expect(nextSetup.ai1).toEqual(neutralDriverSetup('ai1')) // AI untouched
    expect(result.driverResults.some((d) => d.driverId === 'ai1')).toBe(false)
  })

  it('a program against a fully empty ledger aborts cleanly (no crash, no decrement)', () => {
    // No compound supplied + empty ledger: defaultRunCompound falls back to a
    // valid compound, then the run aborts because no sets are available.
    const { result, nextLedger } = runOne({ program: 'setup-work', ledgerRemaining: {} })
    expect(result.driverResults[0].sessionAborted).toBe(true)
    expect(result.driverResults[0].setupConfidenceDelta).toBe(0)
    expect(nextLedger.remaining).toEqual({})
  })

  it('two player drivers share ONE ledger (second sees the first run decrement)', () => {
    const out = runPracticeSession({
      sessionIndex: 0,
      programByDriver: { p1: 'tire-test', p2: 'tire-test' },
      runCompoundByDriver: { p1: 'C5', p2: 'C5' } as never,
      drivers: [P1, P2] as never,
      setup: baseSetup(['p1', 'p2']),
      ledger: ledger({ C5: 3 }), // tire-test costs 2; p1 takes 2 -> 1 left -> p2 aborts
      circuitId: 'monza', round: 5, season: 1, worldSeed: 7, completedAt: 'x',
    })
    const r1 = out.result.driverResults.find((d) => d.driverId === 'p1')!
    const r2 = out.result.driverResults.find((d) => d.driverId === 'p2')!
    expect(r1.sessionAborted).toBe(false)
    expect(r2.sessionAborted).toBe(true)
    expect(out.nextLedger.remaining.C5).toBe(1)
  })
})

describe('diminishing returns + program ordering (averaged over seeds)', () => {
  const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1)

  function avgChain(program: PracticeProgram) {
    const sums = [0, 0, 0]
    let finalConfidence = 0
    for (const seed of SEEDS) {
      let setup = baseSetup(['p1'])
      for (let fp = 0 as 0 | 1 | 2; fp <= 2; fp = (fp + 1) as 0 | 1 | 2) {
        const out = runPracticeSession({
          sessionIndex: fp,
          programByDriver: { p1: program },
          runCompoundByDriver: { p1: 'C5' } as never,
          drivers: [P1] as never,
          setup,
          ledger: ledger({ C5: 20 }),
          circuitId: 'monza', round: 5, season: 1, worldSeed: seed, completedAt: 'x',
        })
        sums[fp] += out.result.driverResults[0].setupConfidenceDelta
        setup = out.nextSetup
      }
      finalConfidence += setup.p1.setupConfidence
    }
    return { fp1: sums[0] / SEEDS.length, fp2: sums[1] / SEEDS.length, fp3: sums[2] / SEEDS.length, finalConfidence: finalConfidence / SEEDS.length }
  }

  it('per-session yield diminishes: avg FP1 > avg FP2 > avg FP3', () => {
    const a = avgChain('setup-work')
    expect(a.fp1).toBeGreaterThan(a.fp2)
    expect(a.fp2).toBeGreaterThan(a.fp3)
  })

  it('accumulated setup confidence never exceeds 100', () => {
    // Worst case: 3 sessions of the highest-confidence program from every seed.
    for (const seed of [1, 7, 42, 99, 256]) {
      let setup = baseSetup(['p1'])
      for (let fp = 0 as 0 | 1 | 2; fp <= 2; fp = (fp + 1) as 0 | 1 | 2) {
        const out = runPracticeSession({
          sessionIndex: fp, programByDriver: { p1: 'setup-work' }, runCompoundByDriver: { p1: 'C5' } as never,
          drivers: [P1] as never, setup, ledger: ledger({ C5: 20 }),
          circuitId: 'monza', round: 5, season: 1, worldSeed: seed, completedAt: 'x',
        })
        setup = out.nextSetup
      }
      expect(setup.p1.setupConfidence).toBeLessThanOrEqual(100)
      expect(setup.p1.tireDegRead).toBeLessThanOrEqual(100)
    }
  })

  it('setup-work accrues more confidence than tire-test; tire-test more tire-deg read', () => {
    const sums = { sw: { c: 0, t: 0 }, tt: { c: 0, t: 0 } }
    for (const seed of SEEDS) {
      const sw = runOne({ program: 'setup-work', compound: 'C5', worldSeed: seed, ledgerRemaining: { C5: 20 } })
      const tt = runOne({ program: 'tire-test', compound: 'C5', worldSeed: seed, ledgerRemaining: { C5: 20 } })
      sums.sw.c += sw.result.driverResults[0].setupConfidenceDelta
      sums.sw.t += sw.result.driverResults[0].tireDegReadDelta
      sums.tt.c += tt.result.driverResults[0].setupConfidenceDelta
      sums.tt.t += tt.result.driverResults[0].tireDegReadDelta
    }
    expect(sums.sw.c).toBeGreaterThan(sums.tt.c) // setup-work > tire-test on confidence
    expect(sums.tt.t).toBeGreaterThan(sums.sw.t) // tire-test > setup-work on tire-deg read
  })
})

describe('simulateDriverProgram fixed-draw discipline', () => {
  it('consumes exactly 2 PRNG draws on every path (run, idle, abort)', () => {
    const paths: Array<{ program: PracticeProgram | null; remaining: WeekendTireLedger['remaining'] }> = [
      { program: 'setup-work', remaining: { C5: 8 } }, // runs
      { program: null, remaining: { C5: 8 } }, // idle
      { program: 'tire-test', remaining: { C5: 0 } }, // aborts (no sets)
    ]
    for (const p of paths) {
      const prng = createPRNG(999)
      let calls = 0
      const counting = { ...prng, next: () => { calls++; return prng.next() } }
      simulateDriverProgram({
        driverId: 'p1', program: p.program, car: CAR, attributes: ATTR,
        current: defaultDriverSetup('p1'), compound: 'C5' as never,
        ledger: ledger(p.remaining), prng: counting as never,
      })
      expect(calls).toBe(2)
    }
  })
})

describe('applySessionToSetup', () => {
  it('adds deltas (clamped 0..100) and increments sessionsCompleted only for real runs', () => {
    const current = baseSetup(['p1', 'p2'])
    const sessionResult = {
      sessionIndex: 0 as const,
      programByDriver: { p1: 'setup-work' as PracticeProgram },
      driverResults: [
        { driverId: 'p1', program: 'setup-work' as PracticeProgram, setupConfidenceDelta: 20, tireDegReadDelta: 5, lapsCompleted: 10, setsConsumed: { C5: 1 }, sessionAborted: false },
        { driverId: 'p2', program: null, setupConfidenceDelta: 0, tireDegReadDelta: 0, lapsCompleted: 0, setsConsumed: {}, sessionAborted: false },
      ],
      completedAt: 'x',
    }
    const next = applySessionToSetup(current, sessionResult)
    expect(next.p1.setupConfidence).toBe(SKIP_SETUP_CONFIDENCE + 20)
    expect(next.p1.sessionsCompleted).toBe(1)
    expect(next.p2).toEqual(current.p2) // idle: unchanged, no session counted
  })
})
