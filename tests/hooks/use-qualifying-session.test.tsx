import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGameStore } from '@/stores/game-store'
import { createInitialRaceRuntime } from '@/stores/race-runtime-slice'
import { createInitialPracticeRuntime } from '@/stores/practice-runtime-slice'
import { createInitialQualiRuntime } from '@/stores/qualifying-runtime-slice'
import { createRaceCommandBus } from '@/engine/race/race-command-bus'
import { useQualifyingSession } from '@/hooks/use-qualifying-session'

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

function initToQualifying() {
  useGameStore.getState().initGame(TEAM_ID, 'golden-era', 1)
  useGameStore.getState().advancePhase() // → practice
  useGameStore.getState().advancePhase() // → qualifying
}

/** Full-grid car count for the active world (the 2026 grid is 22). */
function gridSize(): number {
  const w = useGameStore.getState().world!
  return w.drivers.filter((d) => d.teamId && !d.isReserve && !d.isF2).length
}

/** Generous reveal budget: more ticks than the largest segment (20 entrants)
 *  needs, so a single advance fully reveals + closes the segment. */
const DRIVE_MS = 30 * 450

describe('useQualifyingSession — idle view-model', () => {
  beforeEach(resetStore)

  it('exposes the upcoming Q1, an empty tower, and begin/skip affordances', () => {
    initToQualifying()
    const { result } = renderHook(() => useQualifyingSession())
    const s = result.current.state
    expect(s.sessionPhase).toBe('idle')
    expect(s.format).toBe('qualifying')
    expect(s.segmentLabel).toBe('Q1')
    expect(s.segmentIndex).toBe(0)
    expect(s.totalSegments).toBe(3)
    expect(s.tower).toHaveLength(0)
    expect(s.classification).toBeNull()
    expect(s.canBegin).toBe(true)
    expect(s.canSkip).toBe(true)
  })
})

describe('useQualifyingSession — live reveal', () => {
  beforeEach(() => {
    resetStore()
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('begin blanks the Q1 tower with the full grid and sets the cutline at 15', () => {
    initToQualifying()
    const { result } = renderHook(() => useQualifyingSession())
    act(() => result.current.begin())
    const s = result.current.state
    expect(s.sessionPhase).toBe('running')
    expect(s.segmentLabel).toBe('Q1')
    expect(s.cutlinePosition).toBe(15)
    expect(s.tower.length).toBeGreaterThan(15)
    expect(s.tower.every((e) => e.bestLapTime === null)).toBe(true) // not revealed yet
    expect(s.tower[0].isBelowCutline).toBe(false)
    expect(s.tower[s.tower.length - 1].isBelowCutline).toBe(true) // last row in the drop zone
  })

  it('reveals every entrant then closes the segment (segment-end)', () => {
    initToQualifying()
    const { result } = renderHook(() => useQualifyingSession())
    act(() => result.current.begin())
    act(() => vi.advanceTimersByTime(DRIVE_MS))
    const s = result.current.state
    expect(s.sessionPhase).toBe('segment-end')
    // Every car now carries a revealed time + provisional sectors.
    expect(s.tower.every((e) => e.bestLapTime !== null)).toBe(true)
    expect(s.tower[0].sectors).not.toBeNull()
    // The drop zone (positions 16+) is flagged eliminated after the close.
    expect(s.tower.slice(15).every((e) => e.eliminated)).toBe(true)
    expect(s.tower.slice(0, 15).every((e) => !e.eliminated)).toBe(true)
  })

  it('drives Q1 → Q2 → Q3 to a finished, earned 20-car grid', () => {
    initToQualifying()
    const { result } = renderHook(() => useQualifyingSession())
    act(() => result.current.begin())
    act(() => vi.advanceTimersByTime(DRIVE_MS)) // Q1
    act(() => result.current.nextSegment())
    act(() => vi.advanceTimersByTime(DRIVE_MS)) // Q2
    act(() => result.current.nextSegment())
    act(() => vi.advanceTimersByTime(DRIVE_MS)) // Q3 → auto-finalise

    const N = gridSize()
    const s = result.current.state
    expect(s.sessionPhase).toBe('finished')
    expect(s.classification).not.toBeNull()
    expect(s.classification).toHaveLength(N)
    expect(s.classification![0].isPole).toBe(true)
    expect(s.pole).not.toBeNull()
    // Earned grid is persisted to world for the race hand-off.
    expect(useGameStore.getState().world!.weekendState.qualifyingResult!.gridOrder).toHaveLength(N)
  })
})

describe('useQualifyingSession — skip path', () => {
  beforeEach(resetStore)

  it('skip runs a headless classification and finishes immediately', () => {
    initToQualifying()
    const { result } = renderHook(() => useQualifyingSession())
    act(() => result.current.skip())
    const s = result.current.state
    expect(s.sessionPhase).toBe('finished')
    expect(s.classification).toHaveLength(gridSize())
    expect(useGameStore.getState().world!.weekendState.qualifyingResult).not.toBeNull()
  })
})
