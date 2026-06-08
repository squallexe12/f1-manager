import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '@/stores/game-store'
import { createInitialRaceRuntime } from '@/stores/race-runtime-slice'
import { createRaceCommandBus } from '@/engine/race/race-command-bus'
import type { QualifyingResult, QualiFormat } from '@/types/weekend'

const TEAM_ID = 'mclaren'

function resetStore() {
  useGameStore.setState({
    world: null,
    eventCooldowns: {},
    lastRaceResults: null,
    lastSeasonEnd: null,
    raceCommandBus: createRaceCommandBus(),
    raceRuntime: createInitialRaceRuntime(),
  })
}

function makeResult(format: QualiFormat, poleId: string, gridOrder: string[]): QualifyingResult {
  return {
    format,
    round: 1,
    segments: [],
    gridOrder,
    bestTimes: { [poleId]: 78.123 },
    pole: { driverId: poleId, time: 78.123 },
    fastestLap: { driverId: poleId, time: 78.123 },
    seed: 999,
  }
}

function initWorld(): string {
  useGameStore.getState().initGame(TEAM_ID, 'golden-era', 1)
  const world = useGameStore.getState().world
  if (!world) throw new Error('init failed')
  return world.drivers[0].id
}

describe('commitQualifyingResult', () => {
  beforeEach(resetStore)

  it('writes a standard result to world.weekendState.qualifyingResult', () => {
    const poleId = initWorld()
    const result = makeResult('qualifying', poleId, [poleId])
    useGameStore.getState().commitQualifyingResult(result)
    const ws = useGameStore.getState().world!.weekendState
    expect(ws.qualifyingResult).toEqual(result)
    expect(ws.sprintQualifyingResult).toBeNull()
  })

  it('writes a sprint result to world.weekendState.sprintQualifyingResult', () => {
    const poleId = initWorld()
    const result = makeResult('sprint-qualifying', poleId, [poleId])
    useGameStore.getState().commitQualifyingResult(result)
    const ws = useGameStore.getState().world!.weekendState
    expect(ws.sprintQualifyingResult).toEqual(result)
    expect(ws.qualifyingResult).toBeNull()
  })

  it('increments the pole-sitter seasonStats.poles for a Grand Prix qualifying', () => {
    const poleId = initWorld()
    const before = useGameStore.getState().world!.drivers.find((d) => d.id === poleId)!.seasonStats.poles
    useGameStore.getState().commitQualifyingResult(makeResult('qualifying', poleId, [poleId]))
    const after = useGameStore.getState().world!.drivers.find((d) => d.id === poleId)!.seasonStats.poles
    expect(after).toBe(before + 1)
  })

  it('does NOT increment poles for a sprint-qualifying pole (only the Grand Prix pole is official)', () => {
    const poleId = initWorld()
    const before = useGameStore.getState().world!.drivers.find((d) => d.id === poleId)!.seasonStats.poles
    useGameStore.getState().commitQualifyingResult(makeResult('sprint-qualifying', poleId, [poleId]))
    const after = useGameStore.getState().world!.drivers.find((d) => d.id === poleId)!.seasonStats.poles
    expect(after).toBe(before)
  })

  it('leaves a non-pole driver seasonStats.poles untouched', () => {
    const poleId = initWorld()
    const drivers = useGameStore.getState().world!.drivers
    const otherId = drivers.find((d) => d.id !== poleId)!.id
    const before = drivers.find((d) => d.id === otherId)!.seasonStats.poles
    useGameStore.getState().commitQualifyingResult(makeResult('qualifying', poleId, [poleId, otherId]))
    const after = useGameStore.getState().world!.drivers.find((d) => d.id === otherId)!.seasonStats.poles
    expect(after).toBe(before)
  })

  it('attributes the pole bump to result.pole.driverId, not gridOrder[0]', () => {
    const poleId = initWorld()
    const frontRowId = useGameStore.getState().world!.drivers.find((d) => d.id !== poleId)!.id
    // gridOrder[0] is deliberately NOT the pole-sitter — the bump must follow
    // the engine's result.pole, the stated source of truth.
    const result = makeResult('qualifying', poleId, [frontRowId, poleId])
    const beforePole = useGameStore.getState().world!.drivers.find((d) => d.id === poleId)!.seasonStats.poles
    const beforeFront = useGameStore.getState().world!.drivers.find((d) => d.id === frontRowId)!.seasonStats.poles
    useGameStore.getState().commitQualifyingResult(result)
    const afterPole = useGameStore.getState().world!.drivers.find((d) => d.id === poleId)!.seasonStats.poles
    const afterFront = useGameStore.getState().world!.drivers.find((d) => d.id === frontRowId)!.seasonStats.poles
    expect(afterPole).toBe(beforePole + 1)
    expect(afterFront).toBe(beforeFront) // gridOrder[0] did NOT earn the pole
  })

  it('keeps sprint and standard results independent (committing one does not clear the other)', () => {
    const poleId = initWorld()
    useGameStore.getState().commitQualifyingResult(makeResult('sprint-qualifying', poleId, [poleId]))
    useGameStore.getState().commitQualifyingResult(makeResult('qualifying', poleId, [poleId]))
    const ws = useGameStore.getState().world!.weekendState
    expect(ws.sprintQualifyingResult!.format).toBe('sprint-qualifying')
    expect(ws.qualifyingResult!.format).toBe('qualifying')
  })

  it('persists a JSON-serializable classification inside world (the earned grid is not transient)', () => {
    const poleId = initWorld()
    const result = makeResult('qualifying', poleId, [poleId])
    useGameStore.getState().commitQualifyingResult(result)
    const world = useGameStore.getState().world!
    const roundTripped = JSON.parse(JSON.stringify(world))
    expect(roundTripped.weekendState.qualifyingResult).toEqual(result)
  })

  it('changes the world reference so autosave fires', () => {
    initWorld()
    const before = useGameStore.getState().world
    useGameStore.getState().commitQualifyingResult(makeResult('qualifying', before!.drivers[0].id, [before!.drivers[0].id]))
    const after = useGameStore.getState().world
    expect(after).not.toBe(before)
  })

  it('is a no-op when there is no world', () => {
    expect(() =>
      useGameStore.getState().commitQualifyingResult(makeResult('qualifying', 'x', ['x'])),
    ).not.toThrow()
    expect(useGameStore.getState().world).toBeNull()
  })
})
