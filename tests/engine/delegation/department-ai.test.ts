import { describe, it, expect } from 'vitest'
import {
  classifyApplicable,
  generateRecommendations,
  getAllDepartmentDecisions,
} from '@/engine/delegation/department-ai'
import { createPRNG } from '@/engine/core/prng'
import { initializeGame } from '@/engine/core/state-manager'

function bootWorld() {
  return initializeGame('mclaren', 'golden-era', 42)
}

describe('classifyApplicable', () => {
  it.each([
    ['start-rnd:front-wing-mk2', true],
    ['strategy:1-stop:lap-25', true],
    ['sponsor-outreach', true],
    ['driver-talk:norris', true],
  ])('treats actionable prefix %s as applicable', (action, expected) => {
    expect(classifyApplicable(action)).toBe(expected)
  })

  it.each([
    'monitor',
    'operations',
    'marketing',
    'team-building',
    'sponsor-monitor',
  ])('treats %s as informational-only', (action) => {
    expect(classifyApplicable(action)).toBe(false)
  })
})

describe('generateRecommendations', () => {
  it('produces exactly four recommendations for the player team', () => {
    const world = bootWorld()
    const rng = createPRNG(world.gameState.seed + world.gameState.currentRound)
    const recs = generateRecommendations(world, rng)
    expect(recs).toHaveLength(4)
    const roles = recs.map(r => r.role)
    expect(roles).toEqual(
      expect.arrayContaining([
        'technical-director',
        'race-engineer',
        'commercial-director',
        'team-manager',
      ]),
    )
  })

  it('assigns deterministic ids keyed by round and role', () => {
    const world = bootWorld()
    const rng = createPRNG(world.gameState.seed + world.gameState.currentRound)
    const recs = generateRecommendations(world, rng)
    for (const rec of recs) {
      expect(rec.id).toBe(`${world.gameState.currentRound}:${rec.role}`)
      expect(rec.generatedAtRound).toBe(world.gameState.currentRound)
      expect(rec.status).toBe('active')
    }
  })

  it('is deterministic: same world + same seed → byte-identical output', () => {
    const w1 = bootWorld()
    const w2 = bootWorld()
    const rng1 = createPRNG(w1.gameState.seed + w1.gameState.currentRound)
    const rng2 = createPRNG(w2.gameState.seed + w2.gameState.currentRound)
    const a = generateRecommendations(w1, rng1)
    const b = generateRecommendations(w2, rng2)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('marks each recommendation applicable per its action prefix', () => {
    const world = bootWorld()
    const rng = createPRNG(world.gameState.seed + world.gameState.currentRound)
    const recs = generateRecommendations(world, rng)
    for (const rec of recs) {
      expect(rec.applicable).toBe(classifyApplicable(rec.action))
    }
  })
})

describe('getAllDepartmentDecisions (legacy surface, preserved)', () => {
  it('still returns four raw decisions for parity with pre-IP-08 callers', () => {
    const world = bootWorld()
    const team = world.teams.find(t => t.id === world.gameState.playerTeamId)!
    const rng = createPRNG(1)
    const finance = world.finance[team.id]
    const decisions = getAllDepartmentDecisions(
      team,
      world.drivers,
      finance,
      ['C1', 'C2', 'C3'],
      60,
      rng,
    )
    expect(decisions).toHaveLength(4)
  })
})
