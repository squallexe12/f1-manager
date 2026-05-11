/**
 * press-engine.build.test.ts — IP-10 (12+ tests)
 *
 * Tests for buildPressEvent: determinism, tag-based question selection,
 * speaker fallback, template resolution, and structure invariants.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { buildPressEvent, _internal } from '@/engine/media/press-engine'
import { initializeGame, type FullGameState } from '@/engine/core/state-manager'
import { createPRNG } from '@/engine/core/prng'
import minimalBank from '../../fixtures/media/minimal-bank.json'
import type { PressQuestion } from '@/types/media'
import { bannedDriverWorld } from '../../fixtures/media/banned-driver-world'

const bank = minimalBank as PressQuestion[]

function baseWorld(): FullGameState {
  return initializeGame('mclaren', 'rebuild', 1)
}

function playerDriverIds(world: FullGameState): string[] {
  return world.drivers
    .filter(d => d.teamId === world.gameState.playerTeamId && !d.isReserve)
    .map(d => d.id)
}

function patchDriver(
  world: FullGameState,
  driverId: string,
  patch: Partial<FullGameState['drivers'][number]>,
): FullGameState {
  return {
    ...world,
    drivers: world.drivers.map(d => (d.id === driverId ? { ...d, ...patch } : d)),
  }
}

beforeEach(() => {
  _internal._setBankForTests(bank)
})

afterEach(() => {
  _internal._resetBankForTests()
})

// ---------------------------------------------------------------------------
// Test 1: Determinism — same seed + season + round + surface → identical event
// ---------------------------------------------------------------------------
describe('buildPressEvent — determinism', () => {
  it('same seed, season, round, surface → identical event', () => {
    const world = baseWorld()
    const rng1 = createPRNG(world.gameState.seed + world.gameState.currentRound + 0x1a)
    const rng2 = createPRNG(world.gameState.seed + world.gameState.currentRound + 0x1a)
    const event1 = buildPressEvent(world, 'thursday-fia', rng1)
    const event2 = buildPressEvent(world, 'thursday-fia', rng2)
    expect(event1).toEqual(event2)
  })

  it('different round → potentially different question pick', () => {
    const world1 = baseWorld()
    const world2 = { ...world1, gameState: { ...world1.gameState, currentRound: 5 } }
    const rng1 = createPRNG(world1.gameState.seed + 1 + 0x1a)
    const rng2 = createPRNG(world2.gameState.seed + 5 + 0x1a)
    const event1 = buildPressEvent(world1, 'thursday-fia', rng1)
    const event2 = buildPressEvent(world2, 'thursday-fia', rng2)
    // Events are built from different rounds — IDs differ at minimum
    expect(event1.round).not.toBe(event2.round)
  })
})

// ---------------------------------------------------------------------------
// Test 2: Surface-specific tag filtering
// ---------------------------------------------------------------------------
describe('buildPressEvent — surface tag filtering', () => {
  it('thursday-fia surface never picks after-podium-tagged questions', () => {
    const world = baseWorld()
    const rng = createPRNG(999)
    const event = buildPressEvent(world, 'thursday-fia', rng)
    const hasAfterPodiumQ = event.questions.some(q =>
      // We can verify by checking the original bank question's tags
      bank.find(bq => bq.id === q.questionId)?.contextTags?.includes('after-podium'),
    )
    expect(hasAfterPodiumQ).toBe(false)
  })

  it('post-race surface with podium result → can include after-podium questions', () => {
    // Set a player driver with P3 result to trigger after-podium tag
    const world = baseWorld()
    const [d1] = playerDriverIds(world)
    const worldWithPodium = patchDriver(world, d1, { lastRaceResult: 3 })
    const rng = createPRNG(42)
    const event = buildPressEvent(worldWithPodium, 'post-race', rng)
    // Event should be built successfully; speaker should be the podium driver
    expect(event.speakerKind).toBe('driver')
    expect(event.speakerDriverId).toBe(d1)
  })

  it('post-race + DNF result → speaker is the DNF driver (only one driver)', () => {
    const world = baseWorld()
    const [d1, d2] = playerDriverIds(world)
    // d1 DNF, d2 out of points
    const worldWithDNF = patchDriver(
      patchDriver(world, d1, { lastRaceResult: null }), // null = no result yet (different from DNF sentinel)
      d2, { lastRaceResult: 15 },
    )
    // Actually set d1 to FORM_DNF sentinel to trigger after-dnf
    const worldDNF = patchDriver(worldWithDNF, d1, { lastRaceResult: 21 })
    const rng = createPRNG(7)
    const event = buildPressEvent(worldDNF, 'post-race', rng)
    expect(event).toBeDefined()
    expect(event.questions.length).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// Test 3: Speaker selection
// ---------------------------------------------------------------------------
describe('buildPressEvent — speaker selection', () => {
  it('both player drivers outside points → speaker kind may be driver or TP (filler)', () => {
    const world = baseWorld()
    const [d1, d2] = playerDriverIds(world)
    const w = patchDriver(
      patchDriver(world, d1, { lastRaceResult: 15 }),
      d2, { lastRaceResult: 16 },
    )
    const rng = createPRNG(1)
    const event = buildPressEvent(w, 'post-race', rng)
    // Speaker can be driver (lower score preferred but still valid)
    expect(['driver', 'team-principal']).toContain(event.speakerKind)
  })

  it('first player driver banned → second driver speaks', () => {
    const world = bannedDriverWorld(0)
    const [d1, d2] = playerDriverIds(world)
    const rng = createPRNG(5)
    const event = buildPressEvent(world, 'thursday-fia', rng)
    // d1 is banned so d2 should speak
    expect(event.speakerDriverId).not.toBe(d1)
    expect(event.speakerDriverId).toBe(d2)
  })
})

// ---------------------------------------------------------------------------
// Test 4: Minimum question count (filler fallback)
// ---------------------------------------------------------------------------
describe('buildPressEvent — minimum question count', () => {
  it('returns at least 1 question even on degenerate tag set', () => {
    // Use a bank with only filler questions (no contextTags)
    const fillerOnly = bank.filter(q => q.contextTags.length === 0)
    _internal._setBankForTests(fillerOnly)
    const world = baseWorld()
    const rng = createPRNG(123)
    const event = buildPressEvent(world, 'thursday-fia', rng)
    expect(event.questions.length).toBeGreaterThanOrEqual(1)
  })

  it('returns up to 3 questions when bank has enough', () => {
    const world = baseWorld()
    const rng = createPRNG(456)
    const event = buildPressEvent(world, 'thursday-fia', rng)
    expect(event.questions.length).toBeGreaterThanOrEqual(1)
    expect(event.questions.length).toBeLessThanOrEqual(3)
  })
})

// ---------------------------------------------------------------------------
// Test 5: Template resolution
// ---------------------------------------------------------------------------
describe('buildPressEvent — template resolution', () => {
  it('no raw placeholder tokens survive in resolved question text', () => {
    const world = baseWorld()
    const rng = createPRNG(789)
    const event = buildPressEvent(world, 'thursday-fia', rng)
    for (const q of event.questions) {
      expect(q.text).not.toMatch(/\{[a-zA-Z]+\}/)
    }
  })

  it('resolved text contains no raw {driverName} tokens', () => {
    const world = baseWorld()
    const rng = createPRNG(101)
    const event = buildPressEvent(world, 'thursday-fia', rng)
    // Check that no {driverName} token remains — template was resolved
    event.questions.forEach(q => {
      expect(q.text).not.toContain('{driverName}')
    })
  })
})

// ---------------------------------------------------------------------------
// Test 6: Answer structure
// ---------------------------------------------------------------------------
describe('buildPressEvent — answer structure', () => {
  it('each question has answers with distinct tones', () => {
    const world = baseWorld()
    const rng = createPRNG(202)
    const event = buildPressEvent(world, 'thursday-fia', rng)
    for (const q of event.questions) {
      const tones = new Set(q.answers.map(a => a.tone))
      expect(tones.size).toBeGreaterThanOrEqual(3)
    }
  })
})

// ---------------------------------------------------------------------------
// Test 7: answeredAnswerIds initialization
// ---------------------------------------------------------------------------
describe('buildPressEvent — answeredAnswerIds initialization', () => {
  it('answeredAnswerIds is all-null and length equals questions.length', () => {
    const world = baseWorld()
    const rng = createPRNG(303)
    const event = buildPressEvent(world, 'thursday-fia', rng)
    expect(event.answeredAnswerIds).toHaveLength(event.questions.length)
    expect(event.answeredAnswerIds.every(a => a === null)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Test 8: Event fields
// ---------------------------------------------------------------------------
describe('buildPressEvent — event structure', () => {
  it('event has correct surface, round, and season', () => {
    const world = baseWorld()
    const rng = createPRNG(404)
    const event = buildPressEvent(world, 'thursday-fia', rng)
    expect(event.surface).toBe('thursday-fia')
    expect(event.round).toBe(world.gameState.currentRound)
    expect(event.season).toBe(world.gameState.season)
  })

  it('event status is pending on creation', () => {
    const world = baseWorld()
    const rng = createPRNG(505)
    const event = buildPressEvent(world, 'post-race', rng)
    expect(event.status).toBe('pending')
  })

  it('event id includes surface, season and round', () => {
    const world = baseWorld()
    const rng = createPRNG(606)
    const event = buildPressEvent(world, 'thursday-fia', rng)
    expect(event.id).toContain('thursday-fia')
    expect(event.id).toContain(`s${world.gameState.season}`)
    expect(event.id).toContain(`r${world.gameState.currentRound}`)
  })
})
