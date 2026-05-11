/**
 * determinism-press.test.ts — IP-04 determinism contract
 *
 * Verifies that press injection (Thursday + post-race) does not perturb
 * deterministic output: two runs with the same seed and identical press
 * answers must produce identical world state.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { initializeGame } from '@/engine/core/state-manager'
import {
  advanceGamePhase,
  processPostRacePhase,
} from '@/engine/core/orchestrator'
import { answerPressQuestion } from '@/engine/media/press-engine'
import { _internal } from '@/engine/media/press-engine'
import minimalBank from '../../fixtures/media/minimal-bank.json'
import type { PressQuestion } from '@/types/media'
import type { RaceResult } from '@/engine/core/post-race-processor'

const bank = minimalBank as PressQuestion[]

beforeEach(() => {
  _internal._setBankForTests(bank)
})

afterEach(() => {
  _internal._resetBankForTests()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRaceResults(world: ReturnType<typeof initializeGame>): RaceResult[] {
  return world.drivers
    .filter(d => d.teamId !== null)
    .map((d, i) => ({
      driverId: d.id,
      position: i + 1,
      dnf: false,
      fastestLap: i === 0,
    }))
}

/**
 * Answer all questions in the pending press with the first available answer.
 * Returns the world with the press fully answered (but not yet resolved —
 * resolution is a separate step the caller may or may not invoke).
 */
function answerAllQuestions(
  world: ReturnType<typeof initializeGame>,
): ReturnType<typeof initializeGame> {
  const { pendingPress } = world.media
  if (pendingPress == null) return world

  let w = world
  for (let i = 0; i < pendingPress.questions.length; i++) {
    const firstAnswerId = pendingPress.questions[i].answers[0]?.id
    if (firstAnswerId != null) {
      w = answerPressQuestion(w, i, firstAnswerId)
    }
  }
  return w
}

// ---------------------------------------------------------------------------
// IP-04 determinism: press injection does not perturb race output
// ---------------------------------------------------------------------------
describe('IP-04 determinism: press injection does not perturb deterministic output', () => {
  it('two seeded management→practice advances produce identical thursday press events', () => {
    const seed = 999
    const a = initializeGame('mclaren', 'rebuild', seed)
    const b = initializeGame('mclaren', 'rebuild', seed)

    const nextA = advanceGamePhase(a)
    const nextB = advanceGamePhase(b)

    // Both worlds must be structurally identical after the same transition
    expect(JSON.stringify(nextA)).toBe(JSON.stringify(nextB))

    // Press events must be identical
    expect(nextA.media.pendingPress).toEqual(nextB.media.pendingPress)
  })

  it('answering thursday press identically produces identical driver state', () => {
    const seed = 1234
    let a = initializeGame('mclaren', 'rebuild', seed)
    let b = initializeGame('mclaren', 'rebuild', seed)

    // Advance both to practice (injects thursday press)
    a = advanceGamePhase(a)
    b = advanceGamePhase(b)

    // Answer identically in both worlds
    a = answerAllQuestions(a)
    b = answerAllQuestions(b)

    // Driver state must be identical after identical press answers
    expect(JSON.stringify(a.drivers.map(d => d.mood))).toBe(
      JSON.stringify(b.drivers.map(d => d.mood)),
    )
  })

  it('two seeded processPostRacePhase calls produce identical post-race press events', () => {
    const seed = 5678
    const a = initializeGame('ferrari', 'golden-era', seed)
    const b = initializeGame('ferrari', 'golden-era', seed)

    const resultsA = buildRaceResults(a)
    const resultsB = buildRaceResults(b)

    const { world: nextA } = processPostRacePhase(a, {}, resultsA, null, false)
    const { world: nextB } = processPostRacePhase(b, {}, resultsB, null, false)

    // Both worlds fully identical
    expect(JSON.stringify(nextA)).toBe(JSON.stringify(nextB))

    // Post-race press events identical
    expect(nextA.media.pendingPress).toEqual(nextB.media.pendingPress)
  })

  it('same seed → same driver season stats after post-race (press injection does not drift stats)', () => {
    const seed = 999
    let a = initializeGame('mclaren', 'rebuild', seed)
    let b = initializeGame('mclaren', 'rebuild', seed)

    const resultsA = buildRaceResults(a)
    const resultsB = buildRaceResults(b)

    const { world: afterA } = processPostRacePhase(a, {}, resultsA, null, false)
    const { world: afterB } = processPostRacePhase(b, {}, resultsB, null, false)

    expect(JSON.stringify(afterA.drivers.map(d => d.seasonStats))).toEqual(
      JSON.stringify(afterB.drivers.map(d => d.seasonStats)),
    )
  })
})
