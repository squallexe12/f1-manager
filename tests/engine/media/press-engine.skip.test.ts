/**
 * press-engine.skip.test.ts — IP-10 (4+ tests)
 *
 * Tests for skipPressEvent.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { buildPressEvent, skipPressEvent, _internal } from '@/engine/media/press-engine'
import { initializeGame, type FullGameState } from '@/engine/core/state-manager'
import { createPRNG } from '@/engine/core/prng'
import minimalBank from '../../fixtures/media/minimal-bank.json'
import type { PressQuestion } from '@/types/media'

const bank = minimalBank as PressQuestion[]

function baseWorld(): FullGameState {
  return initializeGame('mclaren', 'rebuild', 1)
}

function worldWithPendingPress(world: FullGameState): FullGameState {
  const rng = createPRNG(world.gameState.seed + 0x1a)
  const event = buildPressEvent(world, 'thursday-fia', rng)
  return { ...world, media: { ...world.media, pendingPress: event } }
}

beforeEach(() => {
  _internal._setBankForTests(bank)
})

afterEach(() => {
  _internal._resetBankForTests()
})

// ---------------------------------------------------------------------------
// Skip tests
// ---------------------------------------------------------------------------
describe('skipPressEvent', () => {
  it('clears pendingPress after skip', () => {
    const world = worldWithPendingPress(baseWorld())
    const rng = createPRNG(10)
    const result = skipPressEvent(world, rng)
    expect(result.media.pendingPress).toBeNull()
  })

  it('appends a transcript with empty exchanges', () => {
    const world = worldWithPendingPress(baseWorld())
    const rng = createPRNG(20)
    const result = skipPressEvent(world, rng)
    expect(result.media.transcripts.length).toBe(1)
    expect(result.media.transcripts[0].exchanges).toHaveLength(0)
  })

  it('applies -3 driverMood penalty to speaker', () => {
    const world = worldWithPendingPress(baseWorld())
    const speakerDriverId = world.media.pendingPress?.speakerDriverId
    const preMood = world.drivers.find(d => d.id === speakerDriverId)?.mood.motivation ?? 50
    const rng = createPRNG(30)
    const result = skipPressEvent(world, rng)
    const afterMood = result.drivers.find(d => d.id === speakerDriverId)?.mood.motivation ?? 50
    expect(afterMood).toBe(preMood - 3)
  })

  it('no-op if no pending press', () => {
    const world = baseWorld()
    const rng = createPRNG(40)
    const result = skipPressEvent(world, rng)
    expect(result).toBe(world)
  })
})
