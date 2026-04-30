// tests/engine/race/radio-picker.test.ts
import { describe, it, expect } from 'vitest'
import { createPRNG } from '@/engine/core/prng'
import { pickRadioMessage, type RadioContext } from '@/engine/race/radio-picker'

function fixtureCtx(overrides: Partial<RadioContext> = {}): RadioContext {
  return {
    category: 'box_box',
    speaker: 'engineer',
    driver: {
      id: 'norris',
      shortName: 'NOR',
      teamId: 'mclaren',
      mood: { motivation: 70, frustration: 20, confidence: 70 },
    },
    team: { id: 'mclaren', name: 'McLaren Racing' },
    lap: 23,
    totalLaps: 50,
    position: 4,
    isPlayerTeam: true,
    ...overrides,
  }
}

describe('pickRadioMessage — determinism', () => {
  it('produces identical output for identical seed + ctx', () => {
    const ctx = fixtureCtx()
    const a = pickRadioMessage(ctx, createPRNG(42))
    const b = pickRadioMessage(ctx, createPRNG(42))
    expect(a).toEqual(b)
  })
})
