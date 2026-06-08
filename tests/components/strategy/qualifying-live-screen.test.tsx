import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { useGameStore } from '@/stores/game-store'
import { createInitialRaceRuntime } from '@/stores/race-runtime-slice'
import { createInitialPracticeRuntime } from '@/stores/practice-runtime-slice'
import { createInitialQualiRuntime } from '@/stores/qualifying-runtime-slice'
import { createRaceCommandBus } from '@/engine/race/race-command-bus'
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

function initToQualifying() {
  useGameStore.getState().initGame(TEAM_ID, 'golden-era', 1)
  useGameStore.getState().advancePhase()
  useGameStore.getState().advancePhase()
}

describe('QualifyingLiveScreen — integration', () => {
  beforeEach(resetStore)
  afterEach(cleanup)

  it('idle: offers Begin Q1 + Skip and renders the per-driver tire controls', () => {
    initToQualifying()
    render(<QualifyingLiveScreen />)
    expect(screen.getByRole('button', { name: /Begin Q1/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Skip Qualifying/i })).toBeInTheDocument()
    // Player tire pickers are present at idle (pre-segment pick).
    expect(screen.getAllByRole('button', { name: /SOFT compound/i }).length).toBeGreaterThan(0)
  })

  it('skip → earned-grid reveal → Confirm Grid advances the phase to the race', () => {
    initToQualifying()
    render(<QualifyingLiveScreen />)

    fireEvent.click(screen.getByRole('button', { name: /Skip Qualifying/i }))
    // The earned grid was committed and the reveal is shown.
    expect(useGameStore.getState().world!.weekendState.qualifyingResult).not.toBeNull()
    const confirm = screen.getByRole('button', { name: /Confirm Grid/i })
    expect(confirm).toBeInTheDocument()

    fireEvent.click(confirm)
    // Hand-off: qualifying → race.
    expect(useGameStore.getState().world!.gameState.phase).toBe('race')
  })
})
