/**
 * use-press-conference.test.ts — Tests for the usePressConference hook.
 *
 * Architecture rules:
 * - Mock the Zustand store to isolate hook logic from engine.
 * - Use renderHook from @testing-library/react.
 * - Verify useShallow prevents unnecessary re-renders.
 */

import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePressConference } from '@/hooks/use-press-conference'
import { useGameStore } from '@/stores/game-store'
import { createRaceCommandBus } from '@/engine/race/race-command-bus'
import { createInitialRaceRuntime } from '@/stores/race-runtime-slice'
import type { PressEvent } from '@/types/media'
import type { Driver } from '@/types/driver'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function makeMinimalPressEvent(overrides?: Partial<PressEvent>): PressEvent {
  return {
    id: 'press-post-race-s1-r1',
    surface: 'post-race',
    speakerKind: 'driver',
    speakerDriverId: 'norris',
    circuit: 'Bahrain International Circuit',
    round: 1,
    season: 1,
    questions: [
      {
        id: 'q-resolved-1',
        questionId: 'q-test-a',
        outlet: 'Sky F1',
        journalist: 'Ted Kravitz',
        text: 'Lando Norris at Bahrain. How do you feel?',
        answers: [
          { id: 'a1', text: 'Great.', tone: 'diplomatic', delta: { driverMood: 2 } },
          { id: 'a2', text: 'OK.', tone: 'evasive', delta: {} },
          { id: 'a3', text: 'Push.', tone: 'aggressive', delta: {} },
          { id: 'a4', text: 'No comment.', tone: 'defiant', delta: {} },
        ],
      },
    ],
    answeredAnswerIds: [null],
    status: 'pending',
    ...overrides,
  }
}

function makeMinimalDriver(overrides?: Partial<Driver>): Driver {
  return {
    id: 'norris',
    firstName: 'Lando',
    lastName: 'Norris',
    shortName: 'NOR',
    nationality: 'British',
    age: 25,
    teamId: 'mclaren',
    attributes: {
      pace: 92,
      racecraft: 88,
      experience: 72,
      mentality: 85,
      marketability: 90,
      developmentPotential: 60,
    },
    mood: { motivation: 80, frustration: 20, confidence: 75 },
    contract: { salary: 10000000, termEndSeason: 2, performanceBonuses: [], releaseClause: null },
    seasonStats: {
      points: 0, wins: 0, podiums: 0, poles: 0, dnfs: 0,
      penalties: 0, bestFinish: 0, averageFinish: 0, lastProcessedRound: 0,
    },
    rivalries: [],
    peakAge: 28,
    declineRate: 0.3,
    isReserve: false,
    isF2: false,
    form: [],
    lastRaceResult: null,
    penaltyPoints: [],
    warningsThisSeason: 0,
    nextRaceGridDrop: 0,
    banUntilRound: null,
    careerWins: 3,
    careerPodiums: 15,
    careerStarts: 100,
    worldTitles: 0,
    pulse: { headline: 'In form', detail: 'Scoring regularly' },
    portraitUrl: '/drivers/norris.avif',
    scoutSignal: 'available',
    scoutingReports: 0,
    ...overrides,
  } as Driver
}

function setWorldWith(
  pendingPress: PressEvent | null,
  drivers: Driver[] = [],
) {
  useGameStore.getState().initGame('mclaren', 'golden-era', 42)
  const w = useGameStore.getState().world!
  useGameStore.setState({
    world: {
      ...w,
      media: { ...w.media, pendingPress },
      drivers: drivers.length > 0 ? drivers : w.drivers,
    },
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('usePressConference', () => {
  beforeEach(resetStore)

  it('returns pendingPress=null and hasPending=false when no pending event', () => {
    useGameStore.setState({ world: null })
    const { result } = renderHook(() => usePressConference())

    expect(result.current.pendingPress).toBeNull()
    expect(result.current.hasPending).toBe(false)
    expect(result.current.speakerLabel).toBe('')
    expect(result.current.questions).toHaveLength(0)
    expect(result.current.progress).toEqual({ answered: 0, total: 0 })
  })

  it('returns correct speakerLabel for a driver speaker', () => {
    const driver = makeMinimalDriver()
    const event = makeMinimalPressEvent({ speakerDriverId: 'norris' })
    setWorldWith(event, [driver])

    const { result } = renderHook(() => usePressConference())

    expect(result.current.hasPending).toBe(true)
    expect(result.current.speakerLabel).toBe('Lando Norris')
    expect(result.current.speakerDriverPortrait).toBe('/drivers/norris.avif')
  })

  it('returns "Team Principal" when speakerDriverId is undefined', () => {
    const event = makeMinimalPressEvent({ speakerDriverId: undefined, speakerKind: 'team-principal' })
    setWorldWith(event)

    const { result } = renderHook(() => usePressConference())

    expect(result.current.speakerLabel).toBe('Team Principal')
    expect(result.current.speakerDriverPortrait).toBeNull()
  })

  it('progress field reflects answered count as answeredAnswerIds populate', async () => {
    const driver = makeMinimalDriver()
    const event = makeMinimalPressEvent({
      questions: [
        {
          id: 'q-r-1', questionId: 'q-test-a', outlet: 'Sky F1', journalist: 'TK',
          text: 'Q1?',
          answers: [{ id: 'a1', text: 'A.', tone: 'diplomatic', delta: {} }],
        },
        {
          id: 'q-r-2', questionId: 'q-test-b', outlet: 'BBC', journalist: 'JH',
          text: 'Q2?',
          answers: [{ id: 'b1', text: 'B.', tone: 'modest', delta: {} }],
        },
      ],
      answeredAnswerIds: [null, null],
    })
    setWorldWith(event, [driver])

    const { result } = renderHook(() => usePressConference())

    // Initially 0/2
    expect(result.current.progress).toEqual({ answered: 0, total: 2 })

    // Simulate answering Q1 via direct setState (bypasses engine intentionally —
    // we test the hook's derivation, not the engine)
    await act(async () => {
      const w = useGameStore.getState().world!
      useGameStore.setState({
        world: {
          ...w,
          media: {
            ...w.media,
            pendingPress: w.media.pendingPress
              ? { ...w.media.pendingPress, answeredAnswerIds: ['a1', null] }
              : null,
          },
        },
      })
    })

    expect(result.current.progress).toEqual({ answered: 1, total: 2 })

    // Answer Q2
    await act(async () => {
      const w = useGameStore.getState().world!
      useGameStore.setState({
        world: {
          ...w,
          media: {
            ...w.media,
            pendingPress: w.media.pendingPress
              ? { ...w.media.pendingPress, answeredAnswerIds: ['a1', 'b1'] }
              : null,
          },
        },
      })
    })

    expect(result.current.progress).toEqual({ answered: 2, total: 2 })
  })

  it('does not re-render when an unrelated world slice changes', async () => {
    const driver = makeMinimalDriver()
    const event = makeMinimalPressEvent({ speakerDriverId: 'norris' })
    setWorldWith(event, [driver])

    let renderCount = 0
    const { result } = renderHook(() => {
      renderCount++
      return usePressConference()
    })

    // One render on mount
    const initialRenderCount = renderCount

    // Mutate an unrelated slice (currentRound scalar inside gameState)
    // This must NOT re-render the hook because useShallow pins: pending, drivers, resolve, skip
    await act(async () => {
      const w = useGameStore.getState().world!
      useGameStore.setState({
        world: {
          ...w,
          gameState: {
            ...w.gameState,
            currentRound: w.gameState.currentRound + 1,
          },
        },
      })
    })

    // The hook should not have re-rendered because none of its subscribed
    // fields (pending, drivers, resolve, skip) changed
    expect(renderCount).toBe(initialRenderCount)

    // But the data is still correct
    expect(result.current.hasPending).toBe(true)
    expect(result.current.speakerLabel).toBe('Lando Norris')
  })
})
