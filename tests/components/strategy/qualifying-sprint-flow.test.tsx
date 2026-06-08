import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, renderHook, act, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { useGameStore } from '@/stores/game-store'
import { createInitialRaceRuntime } from '@/stores/race-runtime-slice'
import { createInitialPracticeRuntime } from '@/stores/practice-runtime-slice'
import { createInitialQualiRuntime } from '@/stores/qualifying-runtime-slice'
import { createRaceCommandBus } from '@/engine/race/race-command-bus'
import { useQualifyingSession } from '@/hooks/use-qualifying-session'
import { QualifyingLiveScreen } from '@/components/strategy/qualifying-live-screen'

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

/** initGame → practice (bootstraps weekendState: tire ledger + per-driver setup
 *  via prepareWeekend). The game always starts at round 1 (a standard weekend),
 *  so we force the phase below to exercise the sprint path on the same world. */
function initWeekend() {
  useGameStore.getState().initGame(TEAM_ID, 'golden-era', 1)
  useGameStore.getState().advancePhase() // management → practice (prepareWeekend)
}

/** Force the FSM phase. The 2026 round-1 weekend is standard, so this is the only
 *  way to reach a sprint-qualifying phase in a unit test without simulating many
 *  full race weekends — it exercises the phase-driven format derivation directly. */
function forcePhase(phase: 'qualifying' | 'sprint-qualifying') {
  const w = useGameStore.getState().world!
  useGameStore.setState({ world: { ...w, gameState: { ...w.gameState, phase } } })
}

describe('qualifying format is PHASE-driven, not weekend-driven', () => {
  beforeEach(resetStore)
  afterEach(cleanup)

  it('a qualifying phase derives the standard Q format', () => {
    initWeekend()
    forcePhase('qualifying')
    const { result } = renderHook(() => useQualifyingSession())
    expect(result.current.state.format).toBe('qualifying')
    expect(result.current.state.segmentLabel).toBe('Q1')
    expect(result.current.state.isSprint).toBe(false)
  })

  it('a sprint-qualifying phase derives the SQ format even on a non-sprint round', () => {
    // Round 1 is a standard weekend (race.isSprint === false) — proving the
    // format follows the PHASE, not race.isSprint (the bug that would mislabel a
    // sprint weekend's later qualifying phase as sprint-qualifying).
    initWeekend()
    expect(useGameStore.getState().world!.calendar[0].isSprint).toBe(false)
    forcePhase('sprint-qualifying')
    const { result } = renderHook(() => useQualifyingSession())
    expect(result.current.state.format).toBe('sprint-qualifying')
    expect(result.current.state.segmentLabel).toBe('SQ1')
    expect(result.current.state.segmentName).toBe('Sprint Qualifying 1')
    expect(result.current.state.isSprint).toBe(true)
  })
})

describe('sprint-qualifying skip path', () => {
  beforeEach(resetStore)
  afterEach(cleanup)

  it('commits sprintQualifyingResult (not qualifyingResult) and earns NO pole', () => {
    initWeekend()
    forcePhase('sprint-qualifying')
    const polesBefore = (() => {
      const w = useGameStore.getState().world!
      return Object.fromEntries(w.drivers.map((d) => [d.id, d.seasonStats.poles]))
    })()

    const { result } = renderHook(() => useQualifyingSession())
    act(() => result.current.skip())

    const w = useGameStore.getState().world!
    expect(w.weekendState.sprintQualifyingResult).not.toBeNull()
    expect(w.weekendState.qualifyingResult).toBeNull() // routed by format
    expect(w.weekendState.sprintQualifyingResult!.format).toBe('sprint-qualifying')
    // Sprint Qualifying winner does NOT earn an official career pole.
    const sqPole = w.weekendState.sprintQualifyingResult!.pole.driverId
    expect(w.drivers.find((d) => d.id === sqPole)!.seasonStats.poles).toBe(polesBefore[sqPole])
  })
})

describe('QualifyingLiveScreen — sprint-qualifying integration', () => {
  beforeEach(resetStore)
  afterEach(cleanup)

  it('renders SQ labels and skips into the earned sprint grid', () => {
    initWeekend()
    forcePhase('sprint-qualifying')
    render(<QualifyingLiveScreen />)

    expect(screen.getByRole('button', { name: /Begin SQ1/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Skip Qualifying/i }))

    expect(useGameStore.getState().world!.weekendState.sprintQualifyingResult).not.toBeNull()
    expect(screen.getByRole('button', { name: /Confirm Grid/i })).toBeInTheDocument()
  })
})
