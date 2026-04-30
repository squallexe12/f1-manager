// tests/data/race-radio.test.ts
import { describe, it, expect } from 'vitest'
import { RADIO_TEMPLATES } from '@/data/race-radio'
import type { RadioArchetype, RadioCategory, RadioSpeaker } from '@/types/radio'

const ALLOWED_TOKENS = new Set([
  'driver', 'opponent', 'gap', 'compound', 'lap', 'laps_remaining', 'position', 'turn',
])

const ARCHETYPES: RadioArchetype[] = [
  'calm-pro', 'hot-headed', 'spiritual', 'emotional', 'rookie', 'veteran',
]

// Categories the engine actually emits (cf. spec §6.4)
const EMITTED: Array<{ category: RadioCategory; speakers: RadioSpeaker[] }> = [
  { category: 'box_box', speakers: ['engineer'] },
  { category: 'pit_confirm', speakers: ['driver'] },
  { category: 'overtake_done', speakers: ['driver'] },
  { category: 'overtake_failed', speakers: ['driver'] },
  { category: 'investigation', speakers: ['fia'] },
  { category: 'penalty_5s', speakers: ['fia'] },
  { category: 'penalty_drive_through', speakers: ['fia'] },
  { category: 'lights_out', speakers: ['engineer'] },
  { category: 'final_lap', speakers: ['engineer'] },
  { category: 'fastest_lap', speakers: ['engineer'] },
  { category: 'tire_complaint', speakers: ['driver'] },
  { category: 'rain_incoming', speakers: ['engineer'] },
  { category: 'push_now', speakers: ['engineer'] },
  { category: 'manage_tires', speakers: ['engineer'] },
  { category: 'driver_frustration', speakers: ['driver'] },
  { category: 'safety_car_deploy', speakers: ['fia'] },
  { category: 'safety_car_in', speakers: ['fia'] },
]

describe('RADIO_TEMPLATES — coverage', () => {
  it.each(EMITTED)('has ≥1 template for $category × $speakers', ({ category, speakers }) => {
    for (const speaker of speakers) {
      const matches = RADIO_TEMPLATES.filter(t => t.category === category && t.speaker === speaker)
      expect(matches.length).toBeGreaterThanOrEqual(1)
    }
  })

  it.each(ARCHETYPES)('has ≥5 templates eligible for archetype %s', (archetype) => {
    const eligible = RADIO_TEMPLATES.filter(t =>
      !t.archetypes || t.archetypes.length === 0 || t.archetypes.includes(archetype),
    )
    expect(eligible.length).toBeGreaterThanOrEqual(5)
  })

  it('every template uses only allowed tokens', () => {
    const tokenRegex = /\{(\w+)\}/g
    for (const t of RADIO_TEMPLATES) {
      const matches = [...t.text.matchAll(tokenRegex)]
      for (const m of matches) {
        expect(ALLOWED_TOKENS.has(m[1])).toBe(true)
      }
    }
  })
})
