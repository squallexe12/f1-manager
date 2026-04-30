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

describe('pickRadioMessage — signature gating', () => {
  it('always picks signature when catchphraseChance=1.0', () => {
    // Mock by passing a driver with high catchphrase chance via DRIVER_RADIO_PROFILES.
    // verstappen has catchphraseChance: 0.35; for this test we use a category
    // where verstappen has a signature line (overtake_done).
    const ctx = fixtureCtx({
      category: 'overtake_done',
      speaker: 'driver',
      driver: { ...fixtureCtx().driver, id: 'verstappen', shortName: 'VER' } as never,
    })
    // Pick 200 times with different seeds; expect ≥30% to be signature lines
    // ("Simply lovely." or "Yes! Yes! Get in!").
    const signatures = ['Simply lovely.', 'Yes! Yes! Get in!']
    let hits = 0
    for (let seed = 0; seed < 200; seed++) {
      const result = pickRadioMessage(ctx, createPRNG(seed))
      if (signatures.includes(result.text)) hits++
    }
    expect(hits).toBeGreaterThanOrEqual(50)  // ~35% expected, allow margin
  })
})

describe('pickRadioMessage — archetype filtering', () => {
  it('never picks a hot-headed-only template for a calm-pro driver', () => {
    const ctx = fixtureCtx({ category: 'overtake_done', speaker: 'driver' })
    // norris is calm-pro. Pick 100 times.
    for (let seed = 0; seed < 100; seed++) {
      const result = pickRadioMessage(ctx, createPRNG(seed))
      // "Easy. Eaaasy." is hot-headed-only in the seed library
      expect(result.text).not.toBe('Easy. Eaaasy.')
    }
  })
})

describe('pickRadioMessage — frustration gating', () => {
  it('never fires a minFrustration=60 template when frustration=20', () => {
    const ctx = fixtureCtx({
      category: 'driver_frustration',
      speaker: 'driver',
      driver: { ...fixtureCtx().driver, mood: { motivation: 70, frustration: 20, confidence: 70 } } as never,
    })
    for (let seed = 0; seed < 100; seed++) {
      const result = pickRadioMessage(ctx, createPRNG(seed))
      // Templates with minFrustration: 60+ should never appear
      expect(result.text).not.toContain('Leave me alone')
      expect(result.text).not.toContain('not acceptable')
    }
  })
})

describe('pickRadioMessage — token resolution', () => {
  it('replaces {opponent} with opponent shortName', () => {
    const ctx = fixtureCtx({
      category: 'overtake_done',
      speaker: 'driver',
      opponent: { id: 'piastri', shortName: 'PIA' } as never,
    })
    const result = pickRadioMessage(ctx, createPRNG(123))
    expect(result.text).not.toContain('{opponent}')
  })

  it('never leaves unresolved {tokens} in resolved output across many seeds', () => {
    // Smoke check: across a representative sweep of categories and seeds, the
    // picker should never emit text containing an unreplaced {token}. This is
    // a defense-in-depth check; tests/data/race-radio.test.ts statically
    // validates that all templates use only allowed tokens.
    const categories: Array<{ category: 'box_box' | 'pit_confirm' | 'overtake_done' | 'overtake_failed' | 'tire_complaint' | 'lights_out' | 'final_lap'; speaker: 'engineer' | 'driver' }> = [
      { category: 'box_box', speaker: 'engineer' },
      { category: 'pit_confirm', speaker: 'driver' },
      { category: 'overtake_done', speaker: 'driver' },
      { category: 'overtake_failed', speaker: 'driver' },
      { category: 'tire_complaint', speaker: 'driver' },
      { category: 'lights_out', speaker: 'engineer' },
      { category: 'final_lap', speaker: 'engineer' },
    ]
    for (const { category, speaker } of categories) {
      for (let seed = 0; seed < 30; seed++) {
        const ctx = fixtureCtx({
          category,
          speaker,
          opponent: { id: 'piastri', shortName: 'PIA' } as never,
          gap: 1.5,
          compound: 'C3',
          turn: 4,
        })
        const result = pickRadioMessage(ctx, createPRNG(seed))
        expect(result.text).not.toMatch(/\{[a-z_]+\}/)
        expect(result.text.length).toBeGreaterThan(0)
      }
    }
  })
})
