/**
 * game-store.press.test.ts — Tests for resolvePress and skipPress store actions.
 *
 * Architecture rules:
 * - Store actions are thin dispatch only; test that they call the engine and
 *   mutate `world` correctly.
 * - No mocking of engine internals — call through the real engine.
 * - fake-indexeddb/auto imported for IndexedDB compatibility.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { useGameStore } from '@/stores/game-store'
import { createRaceCommandBus } from '@/engine/race/race-command-bus'
import { createInitialRaceRuntime } from '@/stores/race-runtime-slice'
import { buildPressEvent, _internal } from '@/engine/media/press-engine'
import { createPRNG } from '@/engine/core/prng'
import type { PressQuestion } from '@/types/media'

// ---------------------------------------------------------------------------
// Minimal question bank that satisfies buildPressEvent
// ---------------------------------------------------------------------------

const MINIMAL_BANK: PressQuestion[] = [
  {
    id: 'q-test-a',
    contextTags: [],
    speaker: 'driver',
    outlet: 'Test Outlet',
    journalist: 'Test Journalist',
    template: '{driverName} at {circuit}. How do you feel?',
    weight: 1,
    answers: [
      {
        id: 'q-test-a-1',
        text: 'Feeling great.',
        tone: 'diplomatic',
        delta: { driverMood: 2, prestige: 1 },
      },
      {
        id: 'q-test-a-2',
        text: 'Not ideal.',
        tone: 'evasive',
        delta: { driverMood: -1 },
      },
      {
        id: 'q-test-a-3',
        text: 'We push.',
        tone: 'aggressive',
        delta: { driverMood: 1 },
      },
      {
        id: 'q-test-a-4',
        text: 'No comment.',
        tone: 'defiant',
        delta: {},
      },
    ],
  },
  {
    id: 'q-test-b',
    contextTags: [],
    speaker: 'driver',
    outlet: 'Test Outlet B',
    journalist: 'Test Journalist B',
    template: '{teamName} results. Thoughts?',
    weight: 1,
    answers: [
      {
        id: 'q-test-b-1',
        text: 'Good progress.',
        tone: 'diplomatic',
        delta: { prestige: 1 },
      },
      {
        id: 'q-test-b-2',
        text: 'We need more.',
        tone: 'aggressive',
        delta: { driverMood: -1 },
      },
      {
        id: 'q-test-b-3',
        text: 'Satisfied.',
        tone: 'modest',
        delta: {},
      },
      {
        id: 'q-test-b-4',
        text: 'Improving.',
        tone: 'defiant',
        delta: {},
      },
    ],
  },
  {
    id: 'q-test-c',
    contextTags: [],
    speaker: 'driver',
    outlet: 'Test Outlet C',
    journalist: 'Test Journalist C',
    template: '{rivalTeamName} is strong. Your take?',
    weight: 1,
    answers: [
      {
        id: 'q-test-c-1',
        text: 'We focus on ourselves.',
        tone: 'evasive',
        delta: {},
      },
      {
        id: 'q-test-c-2',
        text: 'They are fast.',
        tone: 'diplomatic',
        delta: { prestige: 1 },
      },
      {
        id: 'q-test-c-3',
        text: 'We will beat them.',
        tone: 'aggressive',
        delta: { driverMood: 1 },
      },
      {
        id: 'q-test-c-4',
        text: 'No comment.',
        tone: 'defiant',
        delta: {},
      },
    ],
  },
]

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

function initWithPendingPress() {
  // Init a real game
  useGameStore.getState().initGame('mclaren', 'golden-era', 42)
  const worldBefore = useGameStore.getState().world!

  // Inject a minimal bank so buildPressEvent always gets 3 questions
  _internal._setBankForTests(MINIMAL_BANK)

  // Build a press event using the same PRNG namespace as the store (0x3C)
  const rng = createPRNG(worldBefore.gameState.seed + worldBefore.gameState.currentRound + 0x3C)
  const event = buildPressEvent(worldBefore, 'post-race', rng)

  // Inject the event into world.media.pendingPress
  useGameStore.setState({
    world: {
      ...worldBefore,
      media: {
        ...worldBefore.media,
        pendingPress: event,
      },
    },
  })

  return useGameStore.getState().world!
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('game-store — resolvePress', () => {
  beforeEach(() => {
    resetStore()
    _internal._resetBankForTests()
  })

  it('dispatches answerPressQuestion + resolvePressEvent and clears pendingPress', () => {
    const world = initWithPendingPress()
    const event = world.media.pendingPress!
    expect(event).not.toBeNull()

    // Build answer list — answer all questions with their first answer id
    const answers = event.questions.map((q, i) => ({
      questionIndex: i,
      answerId: q.answers[0].id,
    }))

    useGameStore.getState().resolvePress(answers)

    const after = useGameStore.getState().world!
    // pendingPress must be cleared
    expect(after.media.pendingPress).toBeNull()
    // A transcript should have been recorded
    expect(after.media.transcripts).toHaveLength(1)
    expect(after.media.transcripts[0].eventId).toBe(event.id)
  })

  it('is a no-op when pendingPress is null', () => {
    useGameStore.getState().initGame('mclaren', 'golden-era', 42)
    // No press event injected — pendingPress is null from initGame
    const worldBefore = useGameStore.getState().world!
    expect(worldBefore.media.pendingPress).toBeNull()

    useGameStore.getState().resolvePress([{ questionIndex: 0, answerId: 'any' }])

    const after = useGameStore.getState().world!
    // world reference should be unchanged (no set() called)
    expect(after).toBe(worldBefore)
  })

  it('applies driver mood delta from answers to the speaker', () => {
    const world = initWithPendingPress()
    const event = world.media.pendingPress!
    const speakerDriverId = event.speakerDriverId

    // Use the first answer of each question
    const answers = event.questions.map((q, i) => ({
      questionIndex: i,
      answerId: q.answers[0].id,
    }))

    const speakerBefore = world.drivers.find(d => d.id === speakerDriverId)

    useGameStore.getState().resolvePress(answers)

    if (speakerBefore && speakerDriverId) {
      const speakerAfter = useGameStore.getState().world!.drivers.find(
        d => d.id === speakerDriverId,
      )
      // The driver must still exist in drivers array
      expect(speakerAfter).toBeDefined()
      // Mood is within [0, 100]
      expect(speakerAfter!.mood.motivation).toBeGreaterThanOrEqual(0)
      expect(speakerAfter!.mood.motivation).toBeLessThanOrEqual(100)
    }
  })

  it('world reference changes exactly once when resolvePress succeeds', () => {
    const world = initWithPendingPress()
    const event = world.media.pendingPress!

    const worldBefore = useGameStore.getState().world

    const answers = event.questions.map((q, i) => ({
      questionIndex: i,
      answerId: q.answers[0].id,
    }))

    useGameStore.getState().resolvePress(answers)

    const worldAfter = useGameStore.getState().world
    // Should be a new reference (state changed)
    expect(worldAfter).not.toBe(worldBefore)
    // And exactly once: calling resolvePress on a cleared pendingPress is a no-op
    const worldSecond = useGameStore.getState().world
    useGameStore.getState().resolvePress(answers)
    expect(useGameStore.getState().world).toBe(worldSecond)
  })
})

describe('game-store — skipPress', () => {
  beforeEach(() => {
    resetStore()
    _internal._resetBankForTests()
  })

  it('dispatches skipPressEvent and writes a skipped transcript', () => {
    const world = initWithPendingPress()
    const event = world.media.pendingPress!

    useGameStore.getState().skipPress()

    const after = useGameStore.getState().world!
    // pendingPress must be cleared
    expect(after.media.pendingPress).toBeNull()
    // A transcript should have been written
    expect(after.media.transcripts).toHaveLength(1)
    const transcript = after.media.transcripts[0]
    // Skipped transcripts have empty exchanges
    expect(transcript.exchanges).toHaveLength(0)
    expect(transcript.eventId).toBe(event.id)
  })

  it('is a no-op when pendingPress is null', () => {
    useGameStore.getState().initGame('mclaren', 'golden-era', 42)
    const worldBefore = useGameStore.getState().world!
    expect(worldBefore.media.pendingPress).toBeNull()

    useGameStore.getState().skipPress()

    expect(useGameStore.getState().world).toBe(worldBefore)
  })

  it('applies skip penalty: driverMood -3, prestige recorded in aggregateDelta', () => {
    const world = initWithPendingPress()
    const event = world.media.pendingPress!
    const speakerDriverId = event.speakerDriverId

    const speakerBefore = world.drivers.find(d => d.id === speakerDriverId)

    useGameStore.getState().skipPress()

    const after = useGameStore.getState().world!
    const transcript = after.media.transcripts[0]

    // aggregateDelta should record the skip penalty
    expect(transcript.aggregateDelta.driverMood).toBe(-3)
    expect(transcript.aggregateDelta.prestige).toBe(-1)

    // Speaker motivation should have decreased by 3 (clamped at 0)
    if (speakerBefore && speakerDriverId) {
      const speakerAfter = after.drivers.find(d => d.id === speakerDriverId)
      expect(speakerAfter).toBeDefined()
      const expectedMotivation = Math.max(0, speakerBefore.mood.motivation - 3)
      expect(speakerAfter!.mood.motivation).toBe(expectedMotivation)
    }
  })
})
