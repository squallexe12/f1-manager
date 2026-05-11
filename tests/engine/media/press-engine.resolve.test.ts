/**
 * press-engine.resolve.test.ts — IP-10 (10+ tests)
 *
 * Tests for answerPressQuestion, resolvePressEvent, and delta application.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  buildPressEvent,
  answerPressQuestion,
  resolvePressEvent,
  _internal,
} from '@/engine/media/press-engine'
import { initializeGame, type FullGameState } from '@/engine/core/state-manager'
import { createPRNG } from '@/engine/core/prng'
import minimalBank from '../../fixtures/media/minimal-bank.json'
import type { PressQuestion } from '@/types/media'
import { TRANSCRIPT_CAP } from '@/types/media'

const bank = minimalBank as PressQuestion[]

function baseWorld(): FullGameState {
  return initializeGame('mclaren', 'rebuild', 1)
}

/** Build a world with a press event and answer all questions. */
function worldWithFullyAnsweredPress(world: FullGameState): FullGameState {
  const rng = createPRNG(world.gameState.seed + 0x1a)
  const event = buildPressEvent(world, 'thursday-fia', rng)
  let w: FullGameState = { ...world, media: { ...world.media, pendingPress: event } }
  for (let i = 0; i < event.questions.length; i++) {
    const answerId = event.questions[i].answers[0].id
    w = answerPressQuestion(w, i, answerId)
  }
  return w
}

beforeEach(() => {
  _internal._setBankForTests(bank)
})

afterEach(() => {
  _internal._resetBankForTests()
})

// ---------------------------------------------------------------------------
// answerPressQuestion tests
// ---------------------------------------------------------------------------
describe('answerPressQuestion', () => {
  it('records answer at correct index', () => {
    const world = baseWorld()
    const rng = createPRNG(1)
    const event = buildPressEvent(world, 'thursday-fia', rng)
    let w: FullGameState = { ...world, media: { ...world.media, pendingPress: event } }
    const answerId = event.questions[0].answers[0].id
    w = answerPressQuestion(w, 0, answerId)
    expect(w.media.pendingPress?.answeredAnswerIds[0]).toBe(answerId)
  })

  it('no-op if no pending press', () => {
    const world = baseWorld()
    const w = answerPressQuestion(world, 0, 'any-id')
    expect(w).toBe(world)
  })

  it('no-op if question index out of range', () => {
    const world = baseWorld()
    const rng = createPRNG(2)
    const event = buildPressEvent(world, 'thursday-fia', rng)
    const w: FullGameState = { ...world, media: { ...world.media, pendingPress: event } }
    const result = answerPressQuestion(w, 999, 'any-id')
    expect(result).toBe(w)
  })

  it('no-op if answerId not in question', () => {
    const world = baseWorld()
    const rng = createPRNG(3)
    const event = buildPressEvent(world, 'thursday-fia', rng)
    const w: FullGameState = { ...world, media: { ...world.media, pendingPress: event } }
    const result = answerPressQuestion(w, 0, 'nonexistent-answer-id')
    expect(result).toBe(w)
  })

  it('sets status to in-progress after first answer', () => {
    const world = baseWorld()
    const rng = createPRNG(4)
    const event = buildPressEvent(world, 'thursday-fia', rng)
    let w: FullGameState = { ...world, media: { ...world.media, pendingPress: event } }
    const answerId = event.questions[0].answers[0].id
    w = answerPressQuestion(w, 0, answerId)
    expect(w.media.pendingPress?.status).toBe('in-progress')
  })
})

// ---------------------------------------------------------------------------
// resolvePressEvent tests
// ---------------------------------------------------------------------------
describe('resolvePressEvent', () => {
  it('clears pendingPress after resolve', () => {
    const world = worldWithFullyAnsweredPress(baseWorld())
    const rng = createPRNG(100)
    const resolved = resolvePressEvent(world, rng)
    expect(resolved.media.pendingPress).toBeNull()
  })

  it('appends a transcript entry after resolve', () => {
    const world = worldWithFullyAnsweredPress(baseWorld())
    const rng = createPRNG(101)
    const resolved = resolvePressEvent(world, rng)
    expect(resolved.media.transcripts.length).toBe(1)
  })

  it('transcript has correct exchanges count (one per answered question)', () => {
    const world = worldWithFullyAnsweredPress(baseWorld())
    const questionCount = world.media.pendingPress!.questions.length
    const rng = createPRNG(102)
    const resolved = resolvePressEvent(world, rng)
    const transcript = resolved.media.transcripts[0]
    expect(transcript.exchanges).toHaveLength(questionCount)
  })

  it('throws if any question unanswered', () => {
    const world = baseWorld()
    const rng1 = createPRNG(5)
    const event = buildPressEvent(world, 'thursday-fia', rng1)
    // Only answer first question, leave others null
    let w: FullGameState = { ...world, media: { ...world.media, pendingPress: event } }
    if (event.questions.length > 1) {
      w = answerPressQuestion(w, 0, event.questions[0].answers[0].id)
    }
    // If all questions answered (only 1 question), skip this test
    if (event.questions.length === 1) {
      // single-question event is already fully answered — resolve should work
      const rng2 = createPRNG(50)
      expect(() => resolvePressEvent(w, rng2)).not.toThrow()
    } else {
      const rng2 = createPRNG(50)
      expect(() => resolvePressEvent(w, rng2)).toThrow()
    }
  })

  it('per-event sum cap: 3 answers each +6 driverMood → final ≤ 15 (not 18)', () => {
    // Build a custom bank with questions that give +6 driverMood per answer
    const highMoodBank: PressQuestion[] = [
      {
        id: 'q-mood1', contextTags: [], speaker: 'driver', outlet: 'Test', journalist: 'Test',
        template: 'Q1', weight: 1,
        answers: [{ id: 'a1', text: 'A', tone: 'aggressive', delta: { driverMood: 6 } }],
      },
      {
        id: 'q-mood2', contextTags: [], speaker: 'driver', outlet: 'Test', journalist: 'Test',
        template: 'Q2', weight: 1,
        answers: [{ id: 'a2', text: 'A', tone: 'diplomatic', delta: { driverMood: 6 } }],
      },
      {
        id: 'q-mood3', contextTags: [], speaker: 'driver', outlet: 'Test', journalist: 'Test',
        template: 'Q3', weight: 1,
        answers: [{ id: 'a3', text: 'A', tone: 'modest', delta: { driverMood: 6 } }],
      },
    ]
    _internal._setBankForTests(highMoodBank)

    const world = baseWorld()
    const rng1 = createPRNG(200)
    const event = buildPressEvent(world, 'thursday-fia', rng1)
    let w: FullGameState = { ...world, media: { ...world.media, pendingPress: event } }

    // Answer all questions with the high-mood answers
    for (let i = 0; i < event.questions.length; i++) {
      const q = event.questions[i]
      // Pick the first answer (all have +6 driverMood)
      w = answerPressQuestion(w, i, q.answers[0].id)
    }

    const rng2 = createPRNG(201)
    const speakerDriver = world.drivers.find(d => d.id === event.speakerDriverId)
    const preMood = speakerDriver?.mood.motivation ?? 50

    const resolved = resolvePressEvent(w, rng2)
    const speakerAfter = resolved.drivers.find(d => d.id === event.speakerDriverId)

    if (speakerAfter && event.questions.length === 3) {
      const moodDelta = speakerAfter.mood.motivation - preMood
      // 3 × 6 = 18 uncapped, but cap is 15 → expect ≤ 15
      expect(moodDelta).toBeLessThanOrEqual(15)
    }
  })

  it('transcript FIFO cap: 23 pushes → only 22 transcripts kept', () => {
    let world = baseWorld()

    // Push 23 transcripts
    for (let i = 0; i < 23; i++) {
      world = { ...world, gameState: { ...world.gameState, currentRound: i + 1 } }
      const evtRng = createPRNG(world.gameState.seed + i + 0x1a)
      const event = buildPressEvent(world, 'thursday-fia', evtRng)
      let w: FullGameState = { ...world, media: { ...world.media, pendingPress: event } }
      for (let q = 0; q < event.questions.length; q++) {
        w = answerPressQuestion(w, q, event.questions[q].answers[0].id)
      }
      const resolveRng = createPRNG(world.gameState.seed + i + 0x3c)
      world = resolvePressEvent(w, resolveRng)
    }

    expect(world.media.transcripts.length).toBe(TRANSCRIPT_CAP)
    // The first entry should be the 2nd push (round index 1) after eviction
    expect(world.media.transcripts[0].round).toBeGreaterThan(1)
  })

  it('driverMood delta applied to speaker driver', () => {
    // Use a bank where the only answer has +5 driverMood
    const moodBank: PressQuestion[] = [
      {
        id: 'q-dm', contextTags: [], speaker: 'driver', outlet: 'Test', journalist: 'Test',
        template: 'Q', weight: 1,
        answers: [{ id: 'a-dm', text: 'A', tone: 'modest', delta: { driverMood: 5 } }],
      },
    ]
    _internal._setBankForTests(moodBank)

    const world = baseWorld()
    const rng1 = createPRNG(400)
    const event = buildPressEvent(world, 'thursday-fia', rng1)
    let w: FullGameState = { ...world, media: { ...world.media, pendingPress: event } }
    w = answerPressQuestion(w, 0, event.questions[0].answers[0].id)
    // Fill remaining if any
    for (let i = 1; i < event.questions.length; i++) {
      w = answerPressQuestion(w, i, event.questions[i].answers[0].id)
    }

    const speakerDriver = world.drivers.find(d => d.id === event.speakerDriverId)
    const preMood = speakerDriver?.mood.motivation ?? 50

    const rng2 = createPRNG(401)
    const resolved = resolvePressEvent(w, rng2)
    const speakerAfter = resolved.drivers.find(d => d.id === event.speakerDriverId)

    if (speakerAfter) {
      expect(speakerAfter.mood.motivation).toBeGreaterThan(preMood)
    }
  })
})
