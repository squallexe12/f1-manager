/**
 * M8 — Full-chain weekend determinism (the feature's capstone gate).
 *
 * Drives the ENTIRE practice → qualifying → race chain end-to-end and proves it
 * is byte-identical across two runs with the same seed, terminating in the
 * AUTHORITATIVE Web Worker (not the synchronous `simulateRace`). Per AGENTS.md,
 * any change under `src/engine/race/**` (grid-builder, race-simulator) must ship
 * a seeded twice-run test through the worker via `__handleMessage`; M6 proved the
 * race leg, and this test proves the whole chain feeding it.
 *
 * Chain (mirrors the production store/page glue, called as pure engine fns):
 *   initializeGame
 *     → prepareWeekend                      (weekendState: tire ledger + setup)
 *     → 3× runPracticeSession (FP1/FP2/FP3) (accrues player setup confidence)
 *     → processPracticeExit                 (skip-baseline fill — no-op here)
 *     → simulateQualifying                  (earned classification, P1..PN)
 *     → buildQualifyingOrder + applyGridDrops (race grid, pre-/post-penalty)
 *     → computeRacePaceModifier per driver  (setup-confidence consequence)
 *     → drive the WORKER via __handleMessage → raceEnd.finalResults
 *
 * The worker is driven exactly as `tests/engine/race/race-sim-worker.test.ts`:
 * a minimal `self` stub installed before the worker module import, fake timers,
 * and `__handleMessage` / `__resetForTest`.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type {
  BootstrapDriverInput,
  Circuit,
  RaceWorkerStartPayload,
  TireCompound,
  WorkerOutEvent,
  WorkerOutMessage,
} from '@/types/race'
import type { FullGameState } from '@/engine/core/state-manager'
import type {
  PracticeProgram,
  PracticeSessionResult,
  QualifyingResult,
} from '@/types/weekend'

import { initializeGame } from '@/engine/core/state-manager'
import { prepareWeekend, processPracticeExit } from '@/engine/core/orchestrator'
import { runPracticeSession } from '@/engine/practice/practice-engine'
import { simulateQualifying } from '@/engine/qualifying/quali-engine'
import { buildQualifyingOrder } from '@/engine/race/grid-builder'
import { applyGridDrops } from '@/engine/race/race-bootstrap'
import { computeRacePaceModifier } from '@/engine/practice/setup-modifier'

// ── Worker harness (identical setup to race-sim-worker.test.ts) ──────────────
const postedMessages: WorkerOutMessage[] = []
;(globalThis as unknown as { self: unknown }).self = {
  postMessage: (msg: WorkerOutMessage) => {
    postedMessages.push(msg)
  },
  onmessage: () => {},
}
// Import AFTER `self` is defined so the worker sees a valid global.
import { __handleMessage, __resetForTest } from '@/workers/race-sim-worker'
import { buildStartMessage } from '@/workers/race-worker-protocol'

function findEvent<T extends WorkerOutEvent['type']>(type: T): Extract<WorkerOutEvent, { type: T }> | undefined {
  return postedMessages.find((m) => m.type === type) as Extract<WorkerOutEvent, { type: T }> | undefined
}

// ── Chain constants ──────────────────────────────────────────────────────────
const PLAYER_TEAM = 'mclaren'
const SCENARIO = 'golden-era'
// Shorten the worker race so it reaches raceEnd quickly under fake timers.
// Determinism is independent of lap count; only the race leg reads `laps`.
const RACE_LAPS = 10
// Fixed cosmetic stamp — the engine NEVER feeds completedAt to the PRNG, but a
// real `new Date()` would break byte-identical equality, so we pin it.
const FIXED_COMPLETED_AT = '2026-01-01T00:00:00.000Z'

/** Replica of the store-private `buildQualiBootstrapDrivers` (game-store.ts):
 *  every non-reserve, non-F2 racer with a resolvable team, carrying its team car. */
function buildQualiBootstrapDrivers(world: FullGameState): BootstrapDriverInput[] {
  const out: BootstrapDriverInput[] = []
  for (const d of world.drivers) {
    if (!d.teamId || d.isReserve || d.isF2) continue
    const team = world.teams.find((t) => t.id === d.teamId)
    if (!team) continue
    out.push({ id: d.id, teamId: d.teamId, shortName: d.shortName, attributes: d.attributes, mood: d.mood, car: team.car })
  }
  return out
}

interface ChainOutput {
  practiceResults: PracticeSessionResult[]
  classification: QualifyingResult
  gridOrder: string[]
  rosterOrder: string[]
  finalResults: unknown
  raceModifiers: Record<string, number>
}

/**
 * Run the entire standard weekend for one seed and return every observable
 * artifact of the chain. Forces the standard (3-FP, 'qualifying') flow regardless
 * of the calendar's sprint flag for round 1, so the test is independent of where
 * sprint rounds sit in the 2026 calendar.
 */
function runFullWeekend(seed: number): ChainOutput {
  // 1. Deterministic world.
  const world0 = initializeGame(PLAYER_TEAM, SCENARIO, seed)
  const round = world0.gameState.currentRound
  const season = world0.gameState.season
  const circuit: Circuit = { ...world0.calendar[round - 1].circuit, laps: RACE_LAPS }

  // 2. prepareWeekend → weekendState (tire ledger + per-driver setup).
  const world1 = prepareWeekend(world0)

  // Player racers (same filter the store's runPracticeSession action uses).
  const playerTeam = world1.teams.find((t) => t.id === PLAYER_TEAM)!
  const playerDrivers = world1.drivers.filter((d) => d.teamId === PLAYER_TEAM && !d.isReserve && !d.isF2)
  const practiceDriverInputs = playerDrivers.map((d) => ({
    id: d.id, car: playerTeam.car, attributes: d.attributes, isPlayer: true,
  }))
  // Both player drivers run setup-work on the MEDIUM set every session, so soft
  // sets stay intact for qualifying and real setup confidence accrues (the seam
  // we want to exercise carries a non-zero race modifier downstream).
  const programByDriver: Record<string, PracticeProgram> = {}
  const runCompoundByDriver: Record<string, TireCompound> = {}
  for (const d of playerDrivers) {
    programByDriver[d.id] = 'setup-work'
    runCompoundByDriver[d.id] = circuit.compounds[1]
  }

  // 3. 3× runPracticeSession (FP1/FP2/FP3), threading setup + ledger.
  let ws = world1.weekendState
  const practiceResults: PracticeSessionResult[] = []
  for (const fp of [0, 1, 2] as const) {
    const { result, nextSetup, nextLedger } = runPracticeSession({
      sessionIndex: fp,
      programByDriver,
      runCompoundByDriver,
      drivers: practiceDriverInputs,
      setup: ws.driverSetup,
      ledger: ws.tireLedger,
      circuitId: circuit.id,
      round,
      season,
      worldSeed: seed,
      completedAt: FIXED_COMPLETED_AT,
    })
    ws = { ...ws, driverSetup: nextSetup, tireLedger: nextLedger, practiceResults: [...ws.practiceResults, result] }
    practiceResults.push(result)
  }

  // 4. processPracticeExit (practice → qualifying baseline fill).
  let world2: FullGameState = { ...world1, weekendState: ws }
  world2 = processPracticeExit(world2)
  ws = world2.weekendState

  // 5. simulateQualifying — standard 'qualifying' format → earned classification.
  const bootstrapDrivers = buildQualiBootstrapDrivers(world2)
  const rosterOrder = bootstrapDrivers.map((d) => d.id)
  const playerDriverIds = playerDrivers.map((d) => d.id)
  const { result: classification } = simulateQualifying({
    format: 'qualifying',
    round,
    raceSeed: seed,
    drivers: bootstrapDrivers,
    circuit,
    setup: ws.driverSetup,
    playerDriverIds,
    ledger: ws.tireLedger,
  })

  // 6. buildQualifyingOrder + applyGridDrops (no penalties on a clean init).
  const qualifyingOrder = buildQualifyingOrder(rosterOrder, classification)
  const { gridOrder } = applyGridDrops(qualifyingOrder, {})

  // 7. setupModifiers + worker payload — same mapping as page.tsx handleStartRace.
  const driverById = new Map(world2.drivers.map((d) => [d.id, d]))
  const teamById = new Map(world2.teams.map((t) => [t.id, t]))
  const raceModifiers: Record<string, number> = {}
  const payloadDrivers: RaceWorkerStartPayload['drivers'] = gridOrder.map((id) => {
    const d = driverById.get(id)!
    const team = teamById.get(d.teamId ?? '')!
    const setupModifier = computeRacePaceModifier(ws.driverSetup[id]?.setupConfidence ?? 50)
    raceModifiers[id] = setupModifier
    return {
      id: d.id,
      teamId: d.teamId ?? '',
      shortName: d.shortName,
      attributes: d.attributes,
      car: team.car,
      mood: d.mood,
      setupModifier,
    }
  })
  const payload: RaceWorkerStartPayload = { seed, round, circuit, isSprint: false, drivers: payloadDrivers }

  // 8. Drive the AUTHORITATIVE worker → raceEnd.finalResults.
  __resetForTest()
  postedMessages.length = 0
  __handleMessage(buildStartMessage(payload))
  vi.advanceTimersByTime(circuit.laps * 2000 + 5000)
  const end = findEvent('raceEnd')
  if (!end) throw new Error('worker did not reach raceEnd within the advanced time budget')

  return { practiceResults, classification, gridOrder, rosterOrder, finalResults: end.finalResults, raceModifiers }
}

beforeEach(() => {
  postedMessages.length = 0
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  __resetForTest()
})

describe('full-chain weekend determinism (M8)', () => {
  it('is byte-identical across two runs with the same seed (whole chain through the authoritative worker)', () => {
    const a = JSON.stringify(runFullWeekend(4242))
    const b = JSON.stringify(runFullWeekend(4242))
    expect(a).toBe(b)
  })

  it('produces a different outcome for a different seed', () => {
    const a = JSON.stringify(runFullWeekend(4242))
    const b = JSON.stringify(runFullWeekend(9999))
    expect(a).not.toBe(b)
  })

  it('earns the grid: the qualifying classification is pace-ordered, not roster order', () => {
    const out = runFullWeekend(4242)
    const cls = out.classification
    // The grid that feeds the race is a permutation of the full roster…
    expect([...out.gridOrder].sort()).toEqual([...out.rosterOrder].sort())
    // …never the raw roster order (the bug this whole feature exists to fix)…
    expect(cls.gridOrder).not.toEqual(out.rosterOrder)
    expect(out.gridOrder).not.toEqual(out.rosterOrder)
    // …and POSITIVELY earned by pace, not merely "different" (a reversed or
    // shuffled roster would pass the negative checks above):
    //  (a) the pole-sitter is P1 on the grid,
    expect(cls.gridOrder[0]).toBe(cls.pole.driverId)
    //  (b) the final segment (Q3 — the top-10 grid block) is ordered fastest-first,
    const finalSeg = cls.segments[cls.segments.length - 1]
    const q3Times = finalSeg.results.map((r) => r.bestLapTime).filter((t): t is number => t !== null)
    expect(q3Times.length).toBeGreaterThan(1)
    for (let i = 1; i < q3Times.length; i++) expect(q3Times[i]).toBeGreaterThanOrEqual(q3Times[i - 1])
    //  (c) the recorded session fastest lap is the global minimum across all runs.
    const allTimes = Object.values(cls.bestTimes).filter((t): t is number => t !== null)
    expect(cls.fastestLap).not.toBeNull()
    expect(cls.fastestLap!.time).toBe(Math.min(...allTimes))
  })

  it('carries the setup-confidence consequence into the worker (≥1 non-zero race setupModifier)', () => {
    const out = runFullWeekend(4242)
    // Player drivers accrued FP confidence ≠ neutral 50, so their race pace
    // modifier is non-zero — proof the consequence flows engine → grid → worker
    // and isn't silently 0 (the critic's original HIGH finding).
    const nonZero = Object.values(out.raceModifiers).filter((m) => m !== 0)
    expect(nonZero.length).toBeGreaterThan(0)
  })
})
