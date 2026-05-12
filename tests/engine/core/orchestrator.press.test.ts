/**
 * orchestrator.press.test.ts — IP-10 Task 8
 *
 * FSM injection tests for Thursday + post-race press events wired into
 * advanceGamePhase and processPostRacePhase.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { initializeGame, type FullGameState } from '@/engine/core/state-manager'
import {
  advanceGamePhase,
  processPostRacePhase,
} from '@/engine/core/orchestrator'
import type { RaceResult } from '@/engine/core/post-race-processor'
import { _internal } from '@/engine/media/press-engine'
import minimalBank from '../../fixtures/media/minimal-bank.json'
import type { PressQuestion } from '@/types/media'

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

function buildRaceResults(world: FullGameState): RaceResult[] {
  return world.drivers
    .filter(d => d.teamId !== null)
    .map((d, i) => ({
      driverId: d.id,
      position: i + 1,
      dnf: false,
      fastestLap: i === 0,
    }))
}

// ---------------------------------------------------------------------------
// Test 1: management → practice injects Thursday press
// ---------------------------------------------------------------------------
describe('advanceGamePhase — Thursday press injection', () => {
  it('management → practice injects a thursday-fia pending press', () => {
    const world = initializeGame('mclaren', 'rebuild', 1)
    expect(world.gameState.phase).toBe('management')
    expect(world.media.pendingPress).toBeNull()

    const next = advanceGamePhase(world)

    expect(next.gameState.phase).toBe('practice')
    expect(next.media.pendingPress).not.toBeNull()
    expect(next.media.pendingPress?.surface).toBe('thursday-fia')
  })

  it('thursday press round matches the new practice round', () => {
    const world = initializeGame('mclaren', 'rebuild', 42)
    const next = advanceGamePhase(world)

    expect(next.media.pendingPress?.round).toBe(next.gameState.currentRound)
  })
})

// ---------------------------------------------------------------------------
// Test 2: round 1 of new season also injects (management → practice)
// ---------------------------------------------------------------------------
describe('advanceGamePhase — Thursday press fires at season start', () => {
  it('round 1 management → practice still injects thursday press', () => {
    // initializeGame always starts at round 1 management
    const world = initializeGame('ferrari', 'golden-era', 7)
    expect(world.gameState.currentRound).toBe(1)

    const next = advanceGamePhase(world)

    expect(next.gameState.phase).toBe('practice')
    expect(next.media.pendingPress?.surface).toBe('thursday-fia')
    expect(next.media.pendingPress?.round).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Test 3: processPostRacePhase injects post-race press
// ---------------------------------------------------------------------------
describe('processPostRacePhase — post-race press injection', () => {
  it('injects a post-race pending press at the end of processPostRacePhase', () => {
    const world = initializeGame('mercedes', 'golden-era', 99)
    const results = buildRaceResults(world)

    const { world: nextWorld } = processPostRacePhase(world, {}, results, null, false)

    expect(nextWorld.media.pendingPress).not.toBeNull()
    expect(nextWorld.media.pendingPress?.surface).toBe('post-race')
  })

  it('post-race press speaker is a driver from the player team', () => {
    const world = initializeGame('red-bull', 'golden-era', 55)
    const playerDriverIds = world.drivers
      .filter(d => d.teamId === world.gameState.playerTeamId && !d.isReserve)
      .map(d => d.id)
    const results = buildRaceResults(world)

    const { world: nextWorld } = processPostRacePhase(world, {}, results, null, false)

    const press = nextWorld.media.pendingPress
    expect(press).not.toBeNull()
    // speakerKind should be driver (player team has available drivers)
    expect(press?.speakerKind).toBe('driver')
    // speaker must be one of the player team's drivers
    expect(playerDriverIds).toContain(press?.speakerDriverId)
  })
})

// ---------------------------------------------------------------------------
// Test 4: stale pending press is force-resolved as skipped before new Thursday
// ---------------------------------------------------------------------------
describe('advanceGamePhase — stale press force-skip on management → practice', () => {
  it('stale pending press lands in transcripts with status skipped before new press injected', () => {
    let world = initializeGame('mclaren', 'rebuild', 13)
    // Manually inject a pre-existing pending press (simulates a skipped prior week)
    const stalePress = {
      id: 'press-thursday-fia-s1-r0',
      surface: 'thursday-fia' as const,
      speakerKind: 'driver' as const,
      speakerDriverId: world.drivers.find(
        d => d.teamId === world.gameState.playerTeamId && !d.isReserve
      )?.id,
      circuit: 'Bahrain',
      round: 0,
      season: 1,
      questions: [],
      answeredAnswerIds: [],
      status: 'pending' as const,
    }
    world = { ...world, media: { ...world.media, pendingPress: stalePress } }

    const next = advanceGamePhase(world)

    // The stale event should have been skipped and appended to transcripts
    expect(next.media.transcripts.length).toBeGreaterThanOrEqual(1)
    const skippedTranscript = next.media.transcripts.find(t => t.eventId === 'press-thursday-fia-s1-r0')
    expect(skippedTranscript).toBeDefined()
    // A new thursday press for the current round should be pending
    expect(next.media.pendingPress?.surface).toBe('thursday-fia')
    expect(next.media.pendingPress?.id).not.toBe('press-thursday-fia-s1-r0')
  })
})

// ---------------------------------------------------------------------------
// Test 5: press does NOT fire on non-management→practice transitions
// ---------------------------------------------------------------------------
describe('advanceGamePhase — press only fires on management → practice', () => {
  it('practice → qualifying does NOT inject or change pendingPress', () => {
    let world = initializeGame('williams', 'rebuild', 5)
    // Advance to practice first (this will inject a thursday press)
    world = advanceGamePhase(world) // management → practice
    const pressAfterPractice = world.media.pendingPress

    // Now advance practice → qualifying
    const next = advanceGamePhase(world)
    expect(next.gameState.phase).toBe('qualifying')
    // pendingPress should be unchanged (same object reference check via JSON)
    expect(JSON.stringify(next.media.pendingPress)).toBe(JSON.stringify(pressAfterPractice))
  })

  it('qualifying → race does NOT inject or change pendingPress', () => {
    let world = initializeGame('williams', 'rebuild', 6)
    world = advanceGamePhase(world) // management → practice
    world = advanceGamePhase(world) // practice → qualifying
    const pressBeforeRace = world.media.pendingPress

    const next = advanceGamePhase(world) // qualifying → race
    expect(next.gameState.phase).toBe('race')
    expect(JSON.stringify(next.media.pendingPress)).toBe(JSON.stringify(pressBeforeRace))
  })

  it('race → post-race does NOT inject press (post-race injection is via processPostRacePhase)', () => {
    let world = initializeGame('williams', 'rebuild', 7)
    world = advanceGamePhase(world) // management → practice
    world = advanceGamePhase(world) // practice → qualifying
    world = advanceGamePhase(world) // qualifying → race
    const pressBeforePostRace = world.media.pendingPress

    const next = advanceGamePhase(world) // race → post-race
    expect(next.gameState.phase).toBe('post-race')
    expect(JSON.stringify(next.media.pendingPress)).toBe(JSON.stringify(pressBeforePostRace))
  })
})
