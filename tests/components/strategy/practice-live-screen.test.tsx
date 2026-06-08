import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useGameStore } from '@/stores/game-store'
import { createInitialRaceRuntime } from '@/stores/race-runtime-slice'
import { createInitialPracticeRuntime } from '@/stores/practice-runtime-slice'
import { createInitialQualiRuntime } from '@/stores/qualifying-runtime-slice'
import { createRaceCommandBus } from '@/engine/race/race-command-bus'
import { PracticeLiveScreen } from '@/components/strategy/practice-live-screen'

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

function softCompound(): string {
  return useGameStore.getState().world!.calendar[0].circuit.compounds[2]
}

/** Advance fake timers in small steps until the reveal reaches session-end —
 *  robust to changes in the hook's internal step count / interval constants. */
function advanceUntilSessionEnd(maxSteps = 200) {
  for (let i = 0; i < maxSteps; i++) {
    if (useGameStore.getState().practiceRuntime.status === 'session-end') return
    act(() => {
      vi.advanceTimersByTime(450)
    })
  }
}

describe('PracticeLiveScreen', () => {
  beforeEach(resetStore)
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the PLAN phase with FP1 chrome and start/skip CTAs', () => {
    initToPractice()
    render(<PracticeLiveScreen />)
    // FP1 appears both in the chrome session badge and the FP selector pill.
    expect(screen.getAllByText('FP1').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('button', { name: 'Start FP1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skip to Qualifying' })).toBeInTheDocument()
  })

  it('commits the FP result and begins the live reveal on Start', () => {
    initToPractice()
    render(<PracticeLiveScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'Start FP1' }))
    // Durable result committed immediately; transient reveal now running.
    expect(useGameStore.getState().world!.weekendState.practiceResults).toHaveLength(1)
    expect(useGameStore.getState().practiceRuntime.status).toBe('running')
  })

  it('drives the reveal to session-end and snaps bars to the committed setup', () => {
    vi.useFakeTimers()
    initToPractice()
    render(<PracticeLiveScreen />)

    // Pick a real program + tire for the first driver so there is accrual to reveal.
    fireEvent.click(screen.getAllByRole('button', { name: /Race Pace/i })[0])
    fireEvent.click(screen.getAllByRole('button', { name: /SOFT compound/i })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Start FP1' }))

    advanceUntilSessionEnd()

    const st = useGameStore.getState()
    expect(st.practiceRuntime.status).toBe('session-end')
    // The first player driver gained setup confidence above the 35 skip baseline,
    // and the live bar snapped exactly to the committed durable value.
    const firstId = st.world!.drivers.find((d) => d.teamId === TEAM_ID && !d.isReserve && !d.isF2)!.id
    const durable = st.world!.weekendState.driverSetup[firstId].setupConfidence
    expect(durable).toBeGreaterThan(35)
    expect(st.practiceRuntime.driverLive[firstId].setupConfidence).toBeCloseTo(durable, 5)
  })

  it('skips the whole weekend to qualifying via advancePhase', () => {
    initToPractice()
    render(<PracticeLiveScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'Skip to Qualifying' }))
    expect(useGameStore.getState().world!.gameState.phase).toBe('qualifying')
  })

  it('advances to FP2 after completing FP1 via Next Session', () => {
    vi.useFakeTimers()
    initToPractice()
    render(<PracticeLiveScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'Start FP1' }))
    advanceUntilSessionEnd()

    // FP1 (not the last FP) ended → the "Next Session" CTA appears.
    fireEvent.click(screen.getByRole('button', { name: 'Next Session' }))

    const st = useGameStore.getState()
    expect(st.practiceRuntime.status).toBe('idle')
    expect(st.world!.weekendState.practiceResults).toHaveLength(1)
    // The screen now offers FP2 and shows FP1 as done — never re-running FP1.
    expect(screen.getByRole('button', { name: 'Start FP2' })).toBeInTheDocument()
    expect(screen.getByText('✓ Done')).toBeInTheDocument()
    // A genuine second FP can be committed.
    fireEvent.click(screen.getByRole('button', { name: 'Start FP2' }))
    expect(useGameStore.getState().world!.weekendState.practiceResults).toHaveLength(2)
  })

  it('renders a single FP and the sprint advance label on a sprint weekend', () => {
    initToPractice()
    const w = useGameStore.getState().world!
    useGameStore.setState({
      world: {
        ...w,
        calendar: w.calendar.map((r, i) => (i === 0 ? { ...r, isSprint: true } : r)),
        weekendState: {
          ...w.weekendState,
          practiceResults: [{ sessionIndex: 0, programByDriver: {}, driverResults: [], completedAt: 'x' }],
        },
      },
    })
    render(<PracticeLiveScreen />)
    expect(screen.getAllByRole('listitem')).toHaveLength(1) // FP1 only
    expect(screen.getByRole('button', { name: 'Advance to Sprint Qualifying' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Advance to Qualifying' })).not.toBeInTheDocument()
  })

  it('disables a drawn-down compound tire button via the ledger→setsByCompound wiring', () => {
    initToPractice()
    const soft = softCompound()
    const w = useGameStore.getState().world!
    useGameStore.setState({
      world: {
        ...w,
        weekendState: {
          ...w.weekendState,
          tireLedger: { remaining: { ...w.weekendState.tireLedger.remaining, [soft]: 0 } },
        },
      },
    })
    render(<PracticeLiveScreen />)
    const softBtns = screen.getAllByRole('button', { name: /SOFT compound/i })
    expect(softBtns.length).toBeGreaterThan(0)
    softBtns.forEach((b) => expect(b).toBeDisabled())
    // A stocked compound stays selectable.
    screen.getAllByRole('button', { name: /HARD compound/i }).forEach((b) => expect(b).toBeEnabled())
  })
})
