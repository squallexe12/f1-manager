import { describe, it, expect } from 'vitest'
import type { CommentaryEntry } from '@/types/race'
import type { QualiDriverResult, QualiSegmentResult, QualifyingResult } from '@/types/weekend'
import {
  createInitialQualiRuntime,
  reduceQualiEvent,
  QUALI_COMMENTARY_CAP,
  type QualiRuntimeSlice,
} from '@/stores/qualifying-runtime-slice'

function comment(lap: number, text: string): CommentaryEntry {
  return { lap, text, severity: 'info' }
}

function startQ1(): QualiRuntimeSlice {
  const init = reduceQualiEvent(createInitialQualiRuntime(), { type: 'init', format: 'qualifying' })
  return reduceQualiEvent(init, {
    type: 'segmentStart',
    segment: 'Q1',
    entrants: ['a', 'b', 'c'],
    cutlinePosition: 15,
    weather: 'dry',
    timeBudget: 90,
  })
}

describe('createInitialQualiRuntime', () => {
  it('returns an idle baseline', () => {
    expect(createInitialQualiRuntime()).toEqual<QualiRuntimeSlice>({
      format: 'qualifying',
      segment: null,
      sessionPhase: 'idle',
      segmentTimeRemaining: 0,
      driverLive: {},
      cutlinePosition: 0,
      commentary: [],
      finalClassification: null,
      weather: 'dry',
      simSpeed: 1,
    })
  })

  it('produces independent instances', () => {
    const a = createInitialQualiRuntime()
    const b = createInitialQualiRuntime()
    a.commentary.push(comment(1, 'x'))
    a.driverLive.a = { driverId: 'a', bestLapTime: null, compound: null, eliminated: false, onTrack: false }
    expect(b.commentary).toEqual([])
    expect(b.driverLive).toEqual({})
  })
})

describe('reduceQualiEvent', () => {
  it('init resets the session and stamps the format', () => {
    const dirty = startQ1()
    const next = reduceQualiEvent(dirty, { type: 'init', format: 'sprint-qualifying' })
    expect(next.format).toBe('sprint-qualifying')
    expect(next.segment).toBeNull()
    expect(next.sessionPhase).toBe('idle')
    expect(next.driverLive).toEqual({})
  })

  it('segmentStart begins a segment with running phase, clock, cutline, weather, and seeded entrants', () => {
    const next = startQ1()
    expect(next.segment).toBe('Q1')
    expect(next.sessionPhase).toBe('running')
    expect(next.segmentTimeRemaining).toBe(90)
    expect(next.cutlinePosition).toBe(15)
    expect(next.weather).toBe('dry')
    expect(Object.keys(next.driverLive).sort()).toEqual(['a', 'b', 'c'])
    expect(next.driverLive.a).toEqual({ driverId: 'a', bestLapTime: null, compound: null, eliminated: false, onTrack: false })
  })

  it('segmentStart drops drivers eliminated in a prior segment (only the named entrants survive)', () => {
    const q1 = startQ1()
    const q2 = reduceQualiEvent(q1, {
      type: 'segmentStart', segment: 'Q2', entrants: ['a', 'b'], cutlinePosition: 10, weather: 'dry', timeBudget: 60,
    })
    expect(Object.keys(q2.driverLive).sort()).toEqual(['a', 'b'])
    expect(q2.driverLive.c).toBeUndefined()
    expect(q2.driverLive.a.bestLapTime).toBeNull() // fresh segment — best time resets
  })

  it('tick decrements the clock while running and flips to segment-end at zero', () => {
    const running = startQ1()
    const ticked = reduceQualiEvent(running, { type: 'tick', deltaSeconds: 30 })
    expect(ticked.segmentTimeRemaining).toBe(60)
    expect(ticked.sessionPhase).toBe('running')
    const ended = reduceQualiEvent(ticked, { type: 'tick', deltaSeconds: 999 })
    expect(ended.segmentTimeRemaining).toBe(0)
    expect(ended.sessionPhase).toBe('segment-end')
  })

  it('tick is a no-op when not running', () => {
    const idle = createInitialQualiRuntime()
    expect(reduceQualiEvent(idle, { type: 'tick', deltaSeconds: 5 })).toBe(idle)
  })

  it('pause/resume toggle running ↔ paused', () => {
    const running = startQ1()
    const paused = reduceQualiEvent(running, { type: 'pause' })
    expect(paused.sessionPhase).toBe('paused')
    expect(reduceQualiEvent(paused, { type: 'resume' }).sessionPhase).toBe('running')
  })

  it('setSpeed updates the sim speed', () => {
    expect(reduceQualiEvent(createInitialQualiRuntime(), { type: 'setSpeed', speed: 2 }).simSpeed).toBe(2)
  })

  it('selectTire sets a driver compound (creating the entry if absent)', () => {
    const next = reduceQualiEvent(createInitialQualiRuntime(), { type: 'selectTire', driverId: 'z', compound: 'C4' })
    expect(next.driverLive.z.compound).toBe('C4')
    expect(next.driverLive.z.bestLapTime).toBeNull()
  })

  it('sendLap marks a driver on-track; abortLap clears it', () => {
    const running = startQ1()
    const sent = reduceQualiEvent(running, { type: 'sendLap', driverId: 'a' })
    expect(sent.driverLive.a.onTrack).toBe(true)
    const aborted = reduceQualiEvent(sent, { type: 'abortLap', driverId: 'a' })
    expect(aborted.driverLive.a.onTrack).toBe(false)
  })

  it('revealAttempt folds a resolved lap (best time + compound) and clears on-track', () => {
    const running = reduceQualiEvent(startQ1(), { type: 'sendLap', driverId: 'a' })
    const attempt: QualiDriverResult = {
      driverId: 'a',
      bestLapTime: 78.42,
      attempts: [{ driverId: 'a', compound: 'C5', lapTime: 78.42, sector1: 25, sector2: 28, sector3: 25.42, aborted: false, lapDeleted: false }],
      eliminated: false,
      segmentPosition: 1,
    }
    const next = reduceQualiEvent(running, { type: 'revealAttempt', result: attempt })
    expect(next.driverLive.a.bestLapTime).toBe(78.42)
    expect(next.driverLive.a.compound).toBe('C5')
    expect(next.driverLive.a.onTrack).toBe(false)
  })

  it('revealAttempt takes bestLapTime from the result but compound from the LAST attempt (not the fastest)', () => {
    const result: QualiDriverResult = {
      driverId: 'a',
      bestLapTime: 78.0, // the fastest lap was the MIDDLE attempt (C3)
      attempts: [
        { driverId: 'a', compound: 'C5', lapTime: 79.5, sector1: null, sector2: null, sector3: null, aborted: false, lapDeleted: false },
        { driverId: 'a', compound: 'C3', lapTime: 78.0, sector1: null, sector2: null, sector3: null, aborted: false, lapDeleted: false },
        { driverId: 'a', compound: 'C4', lapTime: 80.0, sector1: null, sector2: null, sector3: null, aborted: false, lapDeleted: false },
      ],
      eliminated: false,
      segmentPosition: 1,
    }
    const next = reduceQualiEvent(startQ1(), { type: 'revealAttempt', result })
    expect(next.driverLive.a.bestLapTime).toBe(78.0) // from result.bestLapTime
    expect(next.driverLive.a.compound).toBe('C4') // the LAST attempt's tire, even though it was the slowest
  })

  it('revealAttempt keeps the faster of an existing and a new lap', () => {
    let s = startQ1()
    s = reduceQualiEvent(s, {
      type: 'revealAttempt',
      result: { driverId: 'a', bestLapTime: 79.0, attempts: [], eliminated: false, segmentPosition: 1 },
    })
    s = reduceQualiEvent(s, {
      type: 'revealAttempt',
      result: { driverId: 'a', bestLapTime: 80.5, attempts: [], eliminated: false, segmentPosition: 1 },
    })
    expect(s.driverLive.a.bestLapTime).toBe(79.0)
  })

  it('segmentEnd applies authoritative best times + elimination flags and sets segment-end phase', () => {
    const running = startQ1()
    const result: QualiSegmentResult = {
      segment: 'Q1',
      weather: 'dry',
      results: [
        { driverId: 'a', bestLapTime: 78.0, attempts: [], eliminated: false, segmentPosition: 1 },
        { driverId: 'b', bestLapTime: 78.5, attempts: [], eliminated: false, segmentPosition: 2 },
        { driverId: 'c', bestLapTime: null, attempts: [], eliminated: true, segmentPosition: 3 },
      ],
      advancing: ['a', 'b'],
      eliminated: ['c'],
    }
    const next = reduceQualiEvent(running, { type: 'segmentEnd', result })
    expect(next.sessionPhase).toBe('segment-end')
    expect(next.driverLive.a.eliminated).toBe(false)
    expect(next.driverLive.c.eliminated).toBe(true)
    expect(next.driverLive.b.bestLapTime).toBe(78.5)
  })

  it('commentary appends and caps at QUALI_COMMENTARY_CAP (keeping the most recent)', () => {
    const many = Array.from({ length: QUALI_COMMENTARY_CAP + 10 }, (_, i) => comment(i, `c${i}`))
    const next = reduceQualiEvent(createInitialQualiRuntime(), { type: 'commentary', entries: many })
    expect(next.commentary).toHaveLength(QUALI_COMMENTARY_CAP)
    expect(next.commentary[0].text).toBe('c10')
  })

  it('finalise stores the classification and flips to finished', () => {
    const classification: QualifyingResult = {
      format: 'qualifying',
      round: 1,
      segments: [],
      gridOrder: ['a', 'b', 'c'],
      bestTimes: { a: 78.0 },
      pole: { driverId: 'a', time: 78.0 },
      fastestLap: { driverId: 'a', time: 78.0 },
      seed: 42,
    }
    const next = reduceQualiEvent(startQ1(), { type: 'finalise', classification })
    expect(next.sessionPhase).toBe('finished')
    expect(next.finalClassification).toEqual(classification)
  })

  it('does not mutate the input state', () => {
    const seeded = startQ1()
    const snapshot = JSON.parse(JSON.stringify(seeded))
    reduceQualiEvent(seeded, { type: 'tick', deltaSeconds: 10 })
    reduceQualiEvent(seeded, { type: 'sendLap', driverId: 'a' })
    reduceQualiEvent(seeded, { type: 'commentary', entries: [comment(1, 'x')] })
    expect(seeded).toEqual(snapshot)
  })
})
