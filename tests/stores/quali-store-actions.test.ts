import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '@/stores/game-store'
import { createInitialRaceRuntime } from '@/stores/race-runtime-slice'
import { createInitialPracticeRuntime } from '@/stores/practice-runtime-slice'
import { createInitialQualiRuntime } from '@/stores/qualifying-runtime-slice'
import { createRaceCommandBus } from '@/engine/race/race-command-bus'
import { simulateQualifyingSegment } from '@/engine/qualifying/quali-engine'
import { createPRNG } from '@/engine/core/prng'
import { deriveRaceSeed } from '@/engine/race/race-bootstrap'
import { deriveSessionSeed } from '@/engine/weekend/seed-derivation'
import type { BootstrapDriverInput, TireCompound } from '@/types/race'
import type { QualiSegmentResult } from '@/types/weekend'

const TEAM_ID = 'mclaren'

function resetStore() {
  useGameStore.setState({
    world: null,
    eventCooldowns: {},
    lastRaceResults: null,
    lastSeasonEnd: null,
    raceCommandBus: createRaceCommandBus(),
    raceRuntime: createInitialRaceRuntime(),
    practiceRuntime: createInitialPracticeRuntime(),
    qualifyingRuntime: createInitialQualiRuntime(),
  })
}

/** initGame → management → practice → qualifying. Round 1 ('golden-era') is a
 *  standard weekend, so the phase lands on 'qualifying' (asserted in the suite). */
function initToQualifying() {
  useGameStore.getState().initGame(TEAM_ID, 'golden-era', 1)
  useGameStore.getState().advancePhase() // management → practice
  useGameStore.getState().advancePhase() // practice → qualifying
}

function racerIds(): string[] {
  const w = useGameStore.getState().world!
  return w.drivers.filter((d) => d.teamId && !d.isReserve && !d.isF2).map((d) => d.id)
}

function playerIds(): string[] {
  const w = useGameStore.getState().world!
  return w.drivers.filter((d) => d.teamId === TEAM_ID && !d.isReserve && !d.isF2).map((d) => d.id)
}

function softCompound(): TireCompound {
  return useGameStore.getState().world!.calendar[0].circuit.compounds[2]
}

/** Run all 3 standard segments live with empty player commands (engine defaults
 *  → player auto-runs soft, exactly like the headless path). Returns the
 *  accumulated segment results. */
function runLiveSegments(): QualiSegmentResult[] {
  const seg = [
    { s: 'Q1' as const, adv: 15 },
    { s: 'Q2' as const, adv: 10 },
    { s: 'Q3' as const, adv: 10 },
  ]
  let entrants = racerIds()
  const out: QualiSegmentResult[] = []
  for (const { s, adv } of seg) {
    const r = useGameStore.getState().runQualiSegment({
      segment: s,
      entrants,
      advancingCount: Math.min(adv, entrants.length),
      playerCommands: {},
    })!
    out.push(r)
    entrants = r.advancing
  }
  return out
}

describe('quali store actions — phase guard', () => {
  beforeEach(resetStore)

  it('initToQualifying lands on the standard qualifying phase', () => {
    initToQualifying()
    expect(useGameStore.getState().world!.gameState.phase).toBe('qualifying')
  })

  it('runQualiSegment / headless / commit are no-ops with no world', () => {
    expect(useGameStore.getState().runQualiSegment({ segment: 'Q1', entrants: [], advancingCount: 0, playerCommands: {} })).toBeNull()
    expect(() => useGameStore.getState().runQualifyingHeadless('qualifying')).not.toThrow()
    expect(() => useGameStore.getState().commitLiveQualifyingGrid('qualifying', [])).not.toThrow()
  })
})

describe('runQualiSegment', () => {
  beforeEach(resetStore)

  it('wires the seed exactly like a direct simulateQualifyingSegment call', () => {
    initToQualifying()
    const w = useGameStore.getState().world!
    const entrants = racerIds()
    const drivers: BootstrapDriverInput[] = w.drivers
      .filter((d) => d.teamId && !d.isReserve && !d.isF2)
      .map((d) => {
        const team = w.teams.find((t) => t.id === d.teamId)!
        return { id: d.id, teamId: d.teamId!, shortName: d.shortName, attributes: d.attributes, mood: d.mood, car: team.car }
      })
    const perRoundRoot = deriveRaceSeed(w.gameState.seed, w.gameState.currentRound)
    const expected = simulateQualifyingSegment({
      segment: 'Q1', entrants, advancingCount: 15, drivers,
      circuitCompounds: w.calendar[0].circuit.compounds, weather: 'dry',
      setup: w.weekendState.driverSetup,
      playerDriverIds: new Set(playerIds()), playerCommands: new Map(),
      ledger: w.weekendState.tireLedger,
      prng: createPRNG(deriveSessionSeed(perRoundRoot, 'Q1')),
    }).result

    const got = useGameStore.getState().runQualiSegment({ segment: 'Q1', entrants, advancingCount: 15, playerCommands: {} })!
    expect(JSON.stringify(got)).toBe(JSON.stringify(expected))
  })

  it('blanks the live tower with the entrants and sets the Q1 cutline at 15', () => {
    initToQualifying()
    const entrants = racerIds()
    useGameStore.getState().runQualiSegment({ segment: 'Q1', entrants, advancingCount: 15, playerCommands: {} })
    const rt = useGameStore.getState().qualifyingRuntime
    expect(rt.sessionPhase).toBe('running')
    expect(rt.segment).toBe('Q1')
    expect(rt.cutlinePosition).toBe(15)
    expect(Object.keys(rt.driverLive).sort()).toEqual([...entrants].sort())
    expect(Object.values(rt.driverLive).every((d) => d.bestLapTime === null)).toBe(true)
  })

  it('the final segment (Q3) reports no cutline (0)', () => {
    initToQualifying()
    const top10 = racerIds().slice(0, 10)
    useGameStore.getState().runQualiSegment({ segment: 'Q3', entrants: top10, advancingCount: 10, playerCommands: {} })
    expect(useGameStore.getState().qualifyingRuntime.cutlinePosition).toBe(0)
  })

  it('decrements the weekend tire ledger for player runs only', () => {
    initToQualifying()
    const soft = softCompound()
    const before = useGameStore.getState().world!.weekendState.tireLedger.remaining[soft] ?? 0
    const players = playerIds()
    const entrants = racerIds()
    const playerCommands = Object.fromEntries(players.map((id) => [id, { compound: soft, aborted: false }]))
    useGameStore.getState().runQualiSegment({ segment: 'Q1', entrants, advancingCount: 15, playerCommands })
    const after = useGameStore.getState().world!.weekendState.tireLedger.remaining[soft] ?? 0
    expect(before - after).toBe(players.length) // one soft set per player run; AI never touches it
  })
})

describe('runQualifyingHeadless (skip path)', () => {
  beforeEach(resetStore)

  it('commits a complete N-entry earned grid, bumps pole, and finishes the runtime', () => {
    initToQualifying()
    const racers = racerIds()
    const poleBefore = (() => {
      const w = useGameStore.getState().world!
      return Object.fromEntries(w.drivers.map((d) => [d.id, d.seasonStats.poles]))
    })()

    useGameStore.getState().runQualifyingHeadless('qualifying')

    const w = useGameStore.getState().world!
    const result = w.weekendState.qualifyingResult!
    expect(result).not.toBeNull()
    expect(result.format).toBe('qualifying')
    expect(result.gridOrder).toHaveLength(racers.length)
    // Pole sitter earned exactly one extra career pole (GP format).
    const poleDriver = w.drivers.find((d) => d.id === result.pole.driverId)!
    expect(poleDriver.seasonStats.poles).toBe(poleBefore[result.pole.driverId] + 1)

    const rt = useGameStore.getState().qualifyingRuntime
    expect(rt.sessionPhase).toBe('finished')
    expect(rt.finalClassification!.gridOrder).toEqual(result.gridOrder)
  })
})

describe('commitLiveQualifyingGrid (live finish)', () => {
  beforeEach(resetStore)

  it('collates the live segments into the same earned grid the headless skip produces', () => {
    // Live path: run 3 segments (empty commands) then commit.
    initToQualifying()
    const liveSegments = runLiveSegments()
    useGameStore.getState().commitLiveQualifyingGrid('qualifying', liveSegments)
    const liveGrid = useGameStore.getState().world!.weekendState.qualifyingResult!.gridOrder
    const liveRtPhase = useGameStore.getState().qualifyingRuntime.sessionPhase

    // Headless path on a byte-identical fresh world (same initGame seed).
    resetStore()
    initToQualifying()
    useGameStore.getState().runQualifyingHeadless('qualifying')
    const headlessGrid = useGameStore.getState().world!.weekendState.qualifyingResult!.gridOrder

    expect(liveGrid).toEqual(headlessGrid) // determinism: live reveal == headless skip
    expect(liveRtPhase).toBe('finished')
  })
})
