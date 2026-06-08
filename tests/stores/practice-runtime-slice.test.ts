import { describe, it, expect } from 'vitest'
import type { CommentaryEntry } from '@/types/race'
import {
  createInitialPracticeRuntime,
  reducePracticeEvent,
  PRACTICE_COMMENTARY_CAP,
  type PracticeDriverLive,
  type PracticeRuntimeSlice,
} from '@/stores/practice-runtime-slice'

const DRV_A: PracticeDriverLive = {
  driverId: 'a', program: 'qualifying-sim', compound: 'C5',
  setupConfidence: 35, tireDegRead: 30, lapsCompleted: 0,
}
const DRV_B: PracticeDriverLive = {
  driverId: 'b', program: 'race-pace', compound: 'C3',
  setupConfidence: 35, tireDegRead: 30, lapsCompleted: 0,
}

function comment(lap: number, text: string): CommentaryEntry {
  return { lap, text, severity: 'info' }
}

describe('createInitialPracticeRuntime', () => {
  it('returns an idle baseline with empty live state and commentary', () => {
    expect(createInitialPracticeRuntime()).toEqual<PracticeRuntimeSlice>({
      status: 'idle',
      sessionIndex: 0,
      timeRemaining: 0,
      driverLive: {},
      commentary: [],
      simSpeed: 1,
    })
  })

  it('produces independent instances (no shared mutable references)', () => {
    const a = createInitialPracticeRuntime()
    const b = createInitialPracticeRuntime()
    a.commentary.push(comment(1, 'x'))
    a.driverLive.a = DRV_A
    expect(b.commentary).toEqual([])
    expect(b.driverLive).toEqual({})
  })
})

describe('reducePracticeEvent', () => {
  it('start sets running, sub-session index, clock, live drivers, and clears commentary', () => {
    const seeded = { ...createInitialPracticeRuntime(), commentary: [comment(0, 'stale')] }
    const next = reducePracticeEvent(seeded, {
      type: 'start', sessionIndex: 2, timeBudget: 60, drivers: [DRV_A, DRV_B],
    })
    expect(next.status).toBe('running')
    expect(next.sessionIndex).toBe(2)
    expect(next.timeRemaining).toBe(60)
    expect(next.driverLive).toEqual({ a: DRV_A, b: DRV_B })
    expect(next.commentary).toEqual([])
  })

  it('start preserves the current sim speed', () => {
    const seeded = { ...createInitialPracticeRuntime(), simSpeed: 5 as const }
    const next = reducePracticeEvent(seeded, { type: 'start', sessionIndex: 0, timeBudget: 60, drivers: [] })
    expect(next.simSpeed).toBe(5)
  })

  it('tick decrements the clock while running', () => {
    const running = reducePracticeEvent(createInitialPracticeRuntime(), {
      type: 'start', sessionIndex: 0, timeBudget: 60, drivers: [DRV_A],
    })
    const next = reducePracticeEvent(running, { type: 'tick', deltaSeconds: 10 })
    expect(next.timeRemaining).toBe(50)
    expect(next.status).toBe('running')
  })

  it('tick flips to session-end when the clock reaches zero (never goes negative)', () => {
    const running = reducePracticeEvent(createInitialPracticeRuntime(), {
      type: 'start', sessionIndex: 0, timeBudget: 5, drivers: [DRV_A],
    })
    const next = reducePracticeEvent(running, { type: 'tick', deltaSeconds: 9 })
    expect(next.timeRemaining).toBe(0)
    expect(next.status).toBe('session-end')
  })

  it('tick is a no-op when not running', () => {
    const idle = createInitialPracticeRuntime()
    expect(reducePracticeEvent(idle, { type: 'tick', deltaSeconds: 5 })).toBe(idle)
  })

  it('pause moves running → paused; resume moves paused → running', () => {
    const running = reducePracticeEvent(createInitialPracticeRuntime(), {
      type: 'start', sessionIndex: 0, timeBudget: 60, drivers: [],
    })
    const paused = reducePracticeEvent(running, { type: 'pause' })
    expect(paused.status).toBe('paused')
    const resumed = reducePracticeEvent(paused, { type: 'resume' })
    expect(resumed.status).toBe('running')
  })

  it('pause is a no-op when idle; resume is a no-op when running', () => {
    const idle = createInitialPracticeRuntime()
    expect(reducePracticeEvent(idle, { type: 'pause' })).toBe(idle)
    const running = reducePracticeEvent(idle, { type: 'start', sessionIndex: 0, timeBudget: 60, drivers: [] })
    expect(reducePracticeEvent(running, { type: 'resume' })).toBe(running)
  })

  it('setSpeed updates the sim speed', () => {
    const next = reducePracticeEvent(createInitialPracticeRuntime(), { type: 'setSpeed', speed: 'max' })
    expect(next.simSpeed).toBe('max')
  })

  it('selectRunPlan sets a driver program, creating the entry if absent', () => {
    const next = reducePracticeEvent(createInitialPracticeRuntime(), {
      type: 'selectRunPlan', driverId: 'a', program: 'tire-test',
    })
    expect(next.driverLive.a.program).toBe('tire-test')
    expect(next.driverLive.a.compound).toBeNull()
    expect(next.driverLive.a.setupConfidence).toBe(0)
  })

  it('selectRunPlan preserves an existing driver tire choice', () => {
    const seeded = { ...createInitialPracticeRuntime(), driverLive: { a: { ...DRV_A } } }
    const next = reducePracticeEvent(seeded, { type: 'selectRunPlan', driverId: 'a', program: 'setup-work' })
    expect(next.driverLive.a.program).toBe('setup-work')
    expect(next.driverLive.a.compound).toBe('C5')
  })

  it('selectTire sets a driver compound, creating the entry if absent', () => {
    const next = reducePracticeEvent(createInitialPracticeRuntime(), {
      type: 'selectTire', driverId: 'b', compound: 'C2',
    })
    expect(next.driverLive.b.compound).toBe('C2')
    expect(next.driverLive.b.program).toBeNull()
  })

  it('progress updates a driver live setup/tire-read/laps figures', () => {
    const seeded = { ...createInitialPracticeRuntime(), driverLive: { a: { ...DRV_A } } }
    const next = reducePracticeEvent(seeded, {
      type: 'progress', driverId: 'a', setupConfidence: 62, tireDegRead: 48, lapsCompleted: 12,
    })
    expect(next.driverLive.a).toMatchObject({ setupConfidence: 62, tireDegRead: 48, lapsCompleted: 12 })
    expect(next.driverLive.a.program).toBe('qualifying-sim')
  })

  it('commentary appends entries and caps at PRACTICE_COMMENTARY_CAP (keeping the most recent)', () => {
    const many: CommentaryEntry[] = Array.from({ length: PRACTICE_COMMENTARY_CAP + 25 }, (_, i) => comment(i, `c${i}`))
    const next = reducePracticeEvent(createInitialPracticeRuntime(), { type: 'commentary', entries: many })
    expect(next.commentary).toHaveLength(PRACTICE_COMMENTARY_CAP)
    expect(next.commentary[0].text).toBe('c25')
    expect(next.commentary[PRACTICE_COMMENTARY_CAP - 1].text).toBe(`c${PRACTICE_COMMENTARY_CAP + 24}`)
  })

  it('commentary at exactly the cap drops only the oldest when one more is appended (boundary)', () => {
    const full: CommentaryEntry[] = Array.from({ length: PRACTICE_COMMENTARY_CAP }, (_, i) => comment(i, `c${i}`))
    const atCap = reducePracticeEvent(createInitialPracticeRuntime(), { type: 'commentary', entries: full })
    expect(atCap.commentary).toHaveLength(PRACTICE_COMMENTARY_CAP)
    const plusOne = reducePracticeEvent(atCap, { type: 'commentary', entries: [comment(999, 'newest')] })
    expect(plusOne.commentary).toHaveLength(PRACTICE_COMMENTARY_CAP) // not CAP+1
    expect(plusOne.commentary[0].text).toBe('c1') // c0 (oldest) dropped, exactly one
    expect(plusOne.commentary[PRACTICE_COMMENTARY_CAP - 1].text).toBe('newest')
  })

  it('end flips status to session-end', () => {
    const running = reducePracticeEvent(createInitialPracticeRuntime(), {
      type: 'start', sessionIndex: 0, timeBudget: 60, drivers: [],
    })
    expect(reducePracticeEvent(running, { type: 'end' }).status).toBe('session-end')
  })

  it('does not mutate the input state', () => {
    const seeded = reducePracticeEvent(createInitialPracticeRuntime(), {
      type: 'start', sessionIndex: 1, timeBudget: 60, drivers: [DRV_A],
    })
    const snapshot = JSON.parse(JSON.stringify(seeded))
    reducePracticeEvent(seeded, { type: 'tick', deltaSeconds: 30 })
    reducePracticeEvent(seeded, { type: 'progress', driverId: 'a', setupConfidence: 99, tireDegRead: 99, lapsCompleted: 9 })
    reducePracticeEvent(seeded, { type: 'commentary', entries: [comment(1, 'x')] })
    expect(seeded).toEqual(snapshot)
  })
})
