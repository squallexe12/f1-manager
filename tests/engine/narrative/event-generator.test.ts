import { describe, it, expect } from 'vitest'
import { generateEvents, resolveExpiredEvents } from '@/engine/narrative/event-generator'
import type { NarrativeEvent } from '@/types/narrative'
import { createPRNG } from '@/engine/core/prng'

function mockContext(overrides: Record<string, unknown> = {}) {
  return {
    currentRound: 5,
    playerTeamId: 'mclaren',
    drivers: [
      {
        id: 'd1', teamId: 'mclaren',
        mood: { motivation: 50, frustration: 75, confidence: 60 },
        attributes: { pace: 90, racecraft: 85, experience: 80, mentality: 75, marketability: 80, developmentPotential: 40 },
        rivalries: [], contract: { salary: 10_000_000, termEndSeason: 1, performanceBonuses: [], releaseClause: null },
      },
      {
        id: 'd2', teamId: 'mclaren',
        mood: { motivation: 70, frustration: 30, confidence: 70 },
        attributes: { pace: 85, racecraft: 80, experience: 75, mentality: 80, marketability: 70, developmentPotential: 50 },
        rivalries: [], contract: { salary: 8_000_000, termEndSeason: 3, performanceBonuses: [], releaseClause: null },
      },
    ],
    teams: [
      {
        id: 'mclaren', morale: 80,
        car: { downforce: 85, straightSpeed: 83, reliability: 80, tireManagement: 82, braking: 84, cornering: 86 },
      },
    ],
    finance: {
      mclaren: {
        budget: { cap: 215_000_000, totalSpent: 100_000_000, penaltyRisk: false, categories: [], projectedEndOfSeason: 0 },
        sponsors: [],
        prestige: 'A', prestigeScore: 85, prizeMoneyEstimate: 0, marketingBudget: 15_000_000,
      },
    },
    recentResults: [
      { driverId: 'd1', position: 5, dnf: false },
      { driverId: 'd2', position: 8, dnf: false },
    ],
    ...overrides,
  } as any
}

describe('event generator', () => {
  it('generates events when conditions match', () => {
    // d1 has frustration 75 (> 65 threshold), so rivalry-teammate-clash can fire
    // Try many seeds until we get at least one event (40% chance per template)
    let foundEvent = false
    for (let seed = 0; seed < 50; seed++) {
      const { newEvents } = generateEvents(mockContext(), [], {}, createPRNG(seed))
      if (newEvents.length > 0) {
        foundEvent = true
        break
      }
    }
    expect(foundEvent).toBe(true)
  })

  it('events respect cooldown period', () => {
    const cooldowns = { 'rivalry-teammate-clash': 10 } // cooldown until round 10
    const ctx = mockContext({ currentRound: 5 })
    // Even over many seeds, this specific template should not fire
    for (let seed = 0; seed < 20; seed++) {
      const { newEvents } = generateEvents(ctx, [], cooldowns, createPRNG(seed))
      const clashEvents = newEvents.filter(e => e.id.startsWith('rivalry-teammate-clash'))
      expect(clashEvents).toHaveLength(0)
    }
  })

  it('resolves expired events with default outcomes', () => {
    const events: NarrativeEvent[] = [
      {
        id: 'test-1', thread: 'driver-rivalry', severity: 'decision',
        headline: 'Test', body: 'Test', options: null,
        defaultOutcome: [{ type: 'mood', delta: 5, description: 'Tension builds' }],
        arcId: null, triggeredAtRound: 3, expiresAtRound: 5, resolved: false,
      },
    ]
    const { resolved, consequences } = resolveExpiredEvents(events, 5)
    expect(resolved[0].resolved).toBe(true)
    expect(consequences).toHaveLength(1)
    expect(consequences[0].delta).toBe(5)
  })

  it('does not re-resolve already resolved events', () => {
    const events: NarrativeEvent[] = [
      {
        id: 'test-2', thread: 'driver-rivalry', severity: 'decision',
        headline: 'Test', body: 'Test', options: null,
        defaultOutcome: [{ type: 'mood', delta: 5, description: 'test' }],
        arcId: null, triggeredAtRound: 1, expiresAtRound: 3, resolved: true,
      },
    ]
    const { consequences } = resolveExpiredEvents(events, 5)
    expect(consequences).toHaveLength(0)
  })
})
