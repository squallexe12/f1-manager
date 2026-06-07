import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGameStore } from '@/stores/game-store'
import { createInitialRaceRuntime } from '@/stores/race-runtime-slice'
import { createInitialPracticeRuntime } from '@/stores/practice-runtime-slice'
import { createInitialQualiRuntime } from '@/stores/qualifying-runtime-slice'
import { createRaceCommandBus } from '@/engine/race/race-command-bus'
import { usePracticeSession } from '@/hooks/use-practice-session'
import { fpCount, type PracticeProgram } from '@/types/weekend'

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

function initToPractice() {
  useGameStore.getState().initGame(TEAM_ID, 'golden-era', 1)
  useGameStore.getState().advancePhase()
}

function playerRacerIds(): string[] {
  const w = useGameStore.getState().world!
  return w.drivers.filter((d) => d.teamId === TEAM_ID && !d.isReserve && !d.isF2).map((d) => d.id)
}

describe('usePracticeSession — view-model derivation', () => {
  beforeEach(resetStore)

  it('exposes the active FP label, ledger, and a null leader before any progress', () => {
    initToPractice()
    const w = useGameStore.getState().world!
    const expectedTotal = fpCount(w.calendar[0].isSprint)
    const { result } = renderHook(() => usePracticeSession())

    expect(result.current.state.status).toBe('idle')
    expect(result.current.state.fpTotal).toBe(expectedTotal)
    expect(result.current.state.completedCount).toBe(0)
    expect(result.current.state.activeFpIndex).toBe(0)
    expect(result.current.state.sessionLabel).toBe('FP1')
    expect(result.current.state.leader).toBeNull() // hero renders '—'
    expect(result.current.state.canStart).toBe(true)

    // Ledger maps the 3 circuit compounds hardest→softest; soft is most plentiful.
    expect(result.current.state.ledger).toHaveLength(3)
    expect(result.current.state.ledger[0].role).toBe('hard')
    expect(result.current.state.ledger[2].role).toBe('soft')
    expect(result.current.state.ledger[2].setsRemaining).toBe(7)
    expect(result.current.state.setsRemaining).toBe(3 + 4 + 7)
  })

  it('derives the next FP from persisted practiceResults.length (never re-runs a done FP)', () => {
    initToPractice()
    const ids = playerRacerIds()
    const soft = useGameStore.getState().world!.calendar[0].circuit.compounds[2]
    act(() => {
      useGameStore.getState().runPracticeSession(
        Object.fromEntries(ids.map((id) => [id, 'qualifying-sim' as PracticeProgram])),
        Object.fromEntries(ids.map((id) => [id, soft])) as never,
      )
    })
    const { result } = renderHook(() => usePracticeSession())
    expect(result.current.state.completedCount).toBe(1)
    expect(result.current.state.activeFpIndex).toBe(1)
    expect(result.current.state.sessionLabel).toBe('FP2')
  })

  it('reflects a player run-plan / tire selection through the slice', () => {
    initToPractice()
    const id = playerRacerIds()[0]
    const soft = useGameStore.getState().world!.calendar[0].circuit.compounds[2]
    const { result } = renderHook(() => usePracticeSession())
    act(() => {
      result.current.selectRunPlan(id, 'tire-test')
      result.current.selectTire(id, soft as never)
    })
    const view = result.current.state.drivers.find((d) => d.driverId === id)!
    expect(view.program).toBe('tire-test')
    expect(view.compound).toBe(soft)
  })
})

describe('usePracticeSession — leader emergence + multi-FP accrual', () => {
  beforeEach(resetStore)

  it('surfaces a non-null setup leader after an FP and compounds accrual across two', () => {
    initToPractice()
    const ids = playerRacerIds()
    const soft = useGameStore.getState().world!.calendar[0].circuit.compounds[2]
    const commit = () =>
      useGameStore.getState().runPracticeSession(
        Object.fromEntries(ids.map((id) => [id, 'setup-work' as PracticeProgram])),
        Object.fromEntries(ids.map((id) => [id, soft])) as never,
      )

    const { result } = renderHook(() => usePracticeSession())
    expect(result.current.state.leader).toBeNull()

    act(commit) // FP1
    expect(result.current.state.completedCount).toBe(1)
    expect(result.current.state.leader).not.toBeNull()
    const leaderId = result.current.state.leader!.driverId
    expect(ids).toContain(leaderId)
    const afterFp1 = useGameStore.getState().world!.weekendState.driverSetup[leaderId].setupConfidence
    expect(afterFp1).toBeGreaterThan(35)

    act(commit) // FP2
    expect(result.current.state.completedCount).toBe(2)
    const afterFp2 = useGameStore.getState().world!.weekendState.driverSetup[leaderId].setupConfidence
    expect(afterFp2).toBeGreaterThan(afterFp1) // accrual compounds
  })
})

describe('usePracticeSession — pause/resume during the live reveal', () => {
  beforeEach(resetStore)
  afterEach(() => vi.useRealTimers())

  it('halts the reveal clock while paused and resumes it', () => {
    vi.useFakeTimers()
    initToPractice()
    const id = playerRacerIds()[0]
    const soft = useGameStore.getState().world!.calendar[0].circuit.compounds[2]
    const { result } = renderHook(() => usePracticeSession())

    act(() => {
      result.current.selectRunPlan(id, 'race-pace')
      result.current.selectTire(id, soft as never)
      result.current.startSubSession()
    })
    act(() => vi.advanceTimersByTime(450 * 3))
    const tBeforePause = useGameStore.getState().practiceRuntime.timeRemaining
    expect(tBeforePause).toBeLessThan(3600)

    act(() => result.current.pause())
    act(() => vi.advanceTimersByTime(450 * 5))
    expect(useGameStore.getState().practiceRuntime.status).toBe('paused')
    expect(useGameStore.getState().practiceRuntime.timeRemaining).toBe(tBeforePause) // clock frozen

    act(() => result.current.resume())
    act(() => vi.advanceTimersByTime(450 * 2))
    expect(useGameStore.getState().practiceRuntime.timeRemaining).toBeLessThan(tBeforePause) // ticking again
  })
})

describe('usePracticeSession — useShallow isolation', () => {
  beforeEach(resetStore)

  it('does not re-render on an unrelated store change (raceRuntime)', () => {
    initToPractice()
    let renders = 0
    renderHook(() => {
      renders++
      return usePracticeSession()
    })
    const before = renders
    act(() => {
      useGameStore.getState().setRaceSimSpeed('max') // mutates raceRuntime only
    })
    expect(renders).toBe(before)
  })
})
