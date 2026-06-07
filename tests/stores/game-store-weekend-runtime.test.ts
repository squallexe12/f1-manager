import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '@/stores/game-store'
import { createInitialRaceRuntime } from '@/stores/race-runtime-slice'
import { createInitialPracticeRuntime, type PracticeDriverLive } from '@/stores/practice-runtime-slice'
import { createInitialQualiRuntime } from '@/stores/qualifying-runtime-slice'
import { createRaceCommandBus } from '@/engine/race/race-command-bus'
import { fpCount, type PracticeProgram } from '@/types/weekend'
import type { CommentaryEntry, TireCompound } from '@/types/race'

const TEAM_ID = 'mclaren'

function comment(lap: number, text: string): CommentaryEntry {
  return { lap, text, severity: 'info' }
}

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

function playerRacerIds(): string[] {
  const w = useGameStore.getState().world!
  return w.drivers.filter((d) => d.teamId === TEAM_ID && !d.isReserve && !d.isF2).map((d) => d.id)
}

/** init (management) → advancePhase → practice; prepareWeekend seeds weekendState. */
function initToPractice() {
  useGameStore.getState().initGame(TEAM_ID, 'golden-era', 1)
  useGameStore.getState().advancePhase()
}

function softCompound(): string {
  return useGameStore.getState().world!.calendar[0].circuit.compounds[2]
}

describe('game-store weekend wiring — prepareWeekend / processPracticeExit', () => {
  beforeEach(resetStore)

  it('seeds the weekend bundle (tire ledger + per-driver setup) on management → practice', () => {
    initToPractice()
    const w = useGameStore.getState().world!
    expect(w.gameState.phase).toBe('practice')
    const compounds = w.calendar[0].circuit.compounds
    expect(w.weekendState.tireLedger.remaining[compounds[2]]).toBe(7) // soft = most plentiful
    expect(w.weekendState.tireLedger.remaining[compounds[0]]).toBe(3) // hard = fewest
    expect(Object.keys(w.weekendState.driverSetup).length).toBe(w.drivers.length)
  })

  it('processPracticeExit backfills skip-default setup for a racer who ran no FP (practice → qualifying)', () => {
    initToPractice()
    const target = playerRacerIds()[0]
    // Corrupt the target's setup (sessionsCompleted 0 = never ran a clean FP).
    const w = useGameStore.getState().world!
    useGameStore.setState({
      world: {
        ...w,
        weekendState: {
          ...w.weekendState,
          driverSetup: {
            ...w.weekendState.driverSetup,
            [target]: { driverId: target, setupConfidence: 12, tireDegRead: 7, sessionsCompleted: 0 },
          },
        },
      },
    })
    useGameStore.getState().advancePhase() // practice → qualifying
    const after = useGameStore.getState().world!
    expect(after.gameState.phase).toBe('qualifying')
    expect(after.weekendState.driverSetup[target]).toEqual({
      driverId: target, setupConfidence: 35, tireDegRead: 30, sessionsCompleted: 0,
    })
  })
})

describe('game-store — runPracticeSession world action', () => {
  beforeEach(resetStore)

  it('commits a result: appends practiceResults, decrements the ledger, accrues setup, changes the world ref', () => {
    initToPractice()
    const before = useGameStore.getState().world!
    const soft = softCompound()
    const softBefore = before.weekendState.tireLedger.remaining[soft as never]!
    const ids = playerRacerIds()
    const programByDriver: Record<string, PracticeProgram> = Object.fromEntries(ids.map((id) => [id, 'qualifying-sim']))
    const runCompoundByDriver = Object.fromEntries(ids.map((id) => [id, soft]))

    useGameStore.getState().runPracticeSession(programByDriver, runCompoundByDriver as never)

    const after = useGameStore.getState().world!
    expect(after).not.toBe(before) // world ref changed → autosave fires
    expect(after.weekendState.practiceResults).toHaveLength(1)
    expect(after.weekendState.practiceResults[0].sessionIndex).toBe(0)
    // qualifying-sim costs 1 set/driver → soft drops by the number of player racers
    expect(after.weekendState.tireLedger.remaining[soft as never]).toBe(softBefore - ids.length)
    for (const id of ids) {
      expect(after.weekendState.driverSetup[id].setupConfidence).toBeGreaterThan(35)
      expect(after.weekendState.driverSetup[id].sessionsCompleted).toBe(1)
    }
  })

  it('is a no-op when there is no world', () => {
    expect(() => useGameStore.getState().runPracticeSession({}, {})).not.toThrow()
    expect(useGameStore.getState().world).toBeNull()
  })

  it('is a graceful no-op when the player team is missing (corrupted save), not a crash', () => {
    initToPractice()
    const w = useGameStore.getState().world!
    useGameStore.setState({ world: { ...w, gameState: { ...w.gameState, playerTeamId: 'no-such-team' } } })
    const before = useGameStore.getState().world
    expect(() => useGameStore.getState().runPracticeSession({}, {})).not.toThrow()
    expect(useGameStore.getState().world).toBe(before) // untouched — guard-clause exit, no `!` crash
  })
})

describe('game-store — transient practice/quali runtimes never autosave', () => {
  beforeEach(resetStore)

  it('transient tick/speed actions do not change the world reference', () => {
    initToPractice()
    const ids = playerRacerIds()
    const drivers: PracticeDriverLive[] = ids.map((id) => ({
      driverId: id, program: 'qualifying-sim', compound: 'C5', setupConfidence: 35, tireDegRead: 30, lapsCompleted: 0,
    }))
    useGameStore.getState().startPracticeSession(drivers, 60)
    const worldRef = useGameStore.getState().world
    useGameStore.getState().tickPractice(10)
    useGameStore.getState().setPracticeSpeed('max')
    useGameStore.getState().initQualiSession('qualifying')
    useGameStore.getState().tickQuali(5)
    expect(useGameStore.getState().world).toBe(worldRef)
    expect(useGameStore.getState().practiceRuntime.timeRemaining).toBe(50)
    expect(useGameStore.getState().practiceRuntime.simSpeed).toBe('max')
  })

  it('initQualiSession drives the qualifying runtime without touching world', () => {
    initToPractice()
    const ref = useGameStore.getState().world
    useGameStore.getState().initQualiSession('sprint-qualifying')
    expect(useGameStore.getState().qualifyingRuntime.format).toBe('sprint-qualifying')
    expect(useGameStore.getState().world).toBe(ref)
  })
})

describe('game-store — advancePhase runtime resets + FP-index derivation', () => {
  beforeEach(resetStore)

  it('advancing past post-race resets the race, practice, and qualifying runtimes', () => {
    initToPractice()
    useGameStore.setState({
      raceRuntime: { ...createInitialRaceRuntime(), currentLap: 9 },
      practiceRuntime: { ...createInitialPracticeRuntime(), status: 'running', sessionIndex: 2 },
      qualifyingRuntime: { ...createInitialQualiRuntime(), sessionPhase: 'finished' },
    })
    const w = useGameStore.getState().world!
    useGameStore.setState({ world: { ...w, gameState: { ...w.gameState, phase: 'post-race' } } })
    useGameStore.getState().advancePhase()
    expect(useGameStore.getState().raceRuntime).toEqual(createInitialRaceRuntime())
    expect(useGameStore.getState().practiceRuntime).toEqual(createInitialPracticeRuntime())
    expect(useGameStore.getState().qualifyingRuntime).toEqual(createInitialQualiRuntime())
  })

  it('startPracticeSession derives the FP index from persisted practiceResults.length (reload never re-runs a completed FP)', () => {
    initToPractice()
    const w = useGameStore.getState().world!
    useGameStore.setState({
      world: {
        ...w,
        weekendState: {
          ...w.weekendState,
          practiceResults: [
            { sessionIndex: 0, programByDriver: {}, driverResults: [], completedAt: 'a' },
            { sessionIndex: 1, programByDriver: {}, driverResults: [], completedAt: 'b' },
          ],
        },
      },
      practiceRuntime: createInitialPracticeRuntime(),
    })
    useGameStore.getState().startPracticeSession([], 60)
    expect(useGameStore.getState().practiceRuntime.sessionIndex).toBe(2) // FP3 next, never FP1
  })

  it('advancePracticeSubSession clears all live fields (preserving sim speed) and mirrors the FP index', () => {
    initToPractice()
    const ids = playerRacerIds()
    const soft = softCompound()
    // Commit FP1, then dirty every live field of the runtime.
    useGameStore.getState().runPracticeSession(
      Object.fromEntries(ids.map((id) => [id, 'setup-work' as PracticeProgram])),
      Object.fromEntries(ids.map((id) => [id, soft])) as never,
    )
    useGameStore.getState().setPracticeSpeed(5)
    useGameStore.getState().startPracticeSession(
      ids.map((id) => ({
        driverId: id, program: 'race-pace' as PracticeProgram, compound: soft as TireCompound,
        setupConfidence: 50, tireDegRead: 40, lapsCompleted: 3,
      })),
      60,
    )
    useGameStore.getState().pushPracticeCommentary([comment(1, 'live')])

    useGameStore.getState().advancePracticeSubSession()

    // Everything reset to the idle baseline EXCEPT sim speed (carried for UX),
    // with the FP index mirrored from the one persisted result.
    expect(useGameStore.getState().practiceRuntime).toEqual({
      status: 'idle', sessionIndex: 1, timeRemaining: 0, driverLive: {}, commentary: [], simSpeed: 5,
    })
  })

  it('fpCount bounds the sub-session count: 3 standard, 1 sprint', () => {
    expect(fpCount(false)).toBe(3)
    expect(fpCount(true)).toBe(1)
  })
})

describe('game-store — every transient runtime action leaves the world reference untouched (no autosave)', () => {
  beforeEach(resetStore)

  // The autosave subscriber fires on `world !== prevWorld`. EVERY transient
  // practice/quali action must dispatch to its slice ONLY — a regression that
  // accidentally touched `world` would autosave on every UI tick. One assertion
  // per action class guards each independently.
  const TRANSIENT_ACTIONS: Array<[string, () => void]> = [
    ['startPracticeSession', () => useGameStore.getState().startPracticeSession([], 60)],
    ['tickPractice', () => useGameStore.getState().tickPractice(5)],
    ['pausePractice', () => useGameStore.getState().pausePractice()],
    ['resumePractice', () => useGameStore.getState().resumePractice()],
    ['setPracticeSpeed', () => useGameStore.getState().setPracticeSpeed('max')],
    ['selectPracticeRunPlan', () => useGameStore.getState().selectPracticeRunPlan('x', 'race-pace')],
    ['selectPracticeTire', () => useGameStore.getState().selectPracticeTire('x', 'C3' as TireCompound)],
    ['revealPracticeProgress', () => useGameStore.getState().revealPracticeProgress('x', 50, 40, 5)],
    ['pushPracticeCommentary', () => useGameStore.getState().pushPracticeCommentary([comment(1, 't')])],
    ['advancePracticeSubSession', () => useGameStore.getState().advancePracticeSubSession()],
    ['resetPracticeRuntime', () => useGameStore.getState().resetPracticeRuntime()],
    ['initQualiSession', () => useGameStore.getState().initQualiSession('qualifying')],
    ['advanceQualiSegment', () => useGameStore.getState().advanceQualiSegment({ segment: 'Q1', entrants: ['x'], cutlinePosition: 15, weather: 'dry', timeBudget: 90 })],
    ['tickQuali', () => useGameStore.getState().tickQuali(5)],
    ['pauseQuali', () => useGameStore.getState().pauseQuali()],
    ['resumeQuali', () => useGameStore.getState().resumeQuali()],
    ['setQualiSpeed', () => useGameStore.getState().setQualiSpeed(2)],
    ['selectQualiTire', () => useGameStore.getState().selectQualiTire('x', 'C4' as TireCompound)],
    ['sendQualiLap', () => useGameStore.getState().sendQualiLap('x')],
    ['abortQualiLap', () => useGameStore.getState().abortQualiLap('x')],
    ['revealQualiAttempt', () => useGameStore.getState().revealQualiAttempt({ driverId: 'x', bestLapTime: 78, attempts: [], eliminated: false, segmentPosition: 1 })],
    ['endQualiSegment', () => useGameStore.getState().endQualiSegment({ segment: 'Q1', weather: 'dry', results: [], advancing: [], eliminated: [] })],
    ['pushQualiCommentary', () => useGameStore.getState().pushQualiCommentary([comment(1, 't')])],
    ['finaliseQualiGrid', () => useGameStore.getState().finaliseQualiGrid({ format: 'qualifying', round: 1, segments: [], gridOrder: [], bestTimes: {}, pole: { driverId: 'x', time: null }, fastestLap: null, seed: 1 })],
    ['resetQualiRuntime', () => useGameStore.getState().resetQualiRuntime()],
  ]

  it.each(TRANSIENT_ACTIONS)('%s does not change the world reference', (_name, invoke) => {
    initToPractice()
    const ref = useGameStore.getState().world
    invoke()
    expect(useGameStore.getState().world).toBe(ref)
  })
})
