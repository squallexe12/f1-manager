import { describe, expect, it } from 'vitest'
import { PRESS_BANK } from '@/data/media/press-bank'
import { findUnknownPlaceholders } from '@/engine/media/templates'
import type { PressContextTag } from '@/types/media'

const ALLOWED_TAGS = new Set<PressContextTag>([
  'after-podium', 'after-points', 'after-zero-points', 'after-dnf',
  'after-crash', 'teammate-beat-you', 'beat-teammate', 'after-pole',
  'after-q1-exit', 'contract-expiring', 'rumored-poach', 'reg-controversy',
  'penalty-received', 'budget-cap-pressure', 'season-opener', 'season-finale',
  'home-race', 'driver-mood-low', 'driver-mood-high', 'prestige-rising', 'prestige-falling',
])

describe('press bank validation', () => {
  it('every id is unique', () => {
    const ids = PRESS_BANK.map(q => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every contextTag is a known PressContextTag', () => {
    for (const q of PRESS_BANK) {
      for (const t of q.contextTags) {
        expect(ALLOWED_TAGS.has(t), `Unknown tag ${t} on ${q.id}`).toBe(true)
      }
    }
  })

  it('every template uses only known placeholders', () => {
    for (const q of PRESS_BANK) {
      expect(findUnknownPlaceholders(q.template), `Unknown placeholders in ${q.id}`).toEqual([])
    }
  })

  it('every question has 3-4 answers with at least 3 distinct tones', () => {
    for (const q of PRESS_BANK) {
      expect(q.answers.length, q.id).toBeGreaterThanOrEqual(3)
      expect(q.answers.length, q.id).toBeLessThanOrEqual(4)
      const tones = new Set(q.answers.map(a => a.tone))
      expect(tones.size, `${q.id} has only ${tones.size} tones`).toBeGreaterThanOrEqual(3)
    }
  })

  it('per-answer delta bounds respected', () => {
    for (const q of PRESS_BANK) {
      for (const a of q.answers) {
        const d = a.delta
        if (d.driverMood !== undefined) expect(Math.abs(d.driverMood), a.id).toBeLessThanOrEqual(10)
        if (d.teammateMood !== undefined) expect(Math.abs(d.teammateMood), a.id).toBeLessThanOrEqual(5)
        if (d.sponsorKPI !== undefined) expect(Math.abs(d.sponsorKPI), a.id).toBeLessThanOrEqual(3)
        if (d.prestige !== undefined) expect(Math.abs(d.prestige), a.id).toBeLessThanOrEqual(2)
        if (d.rumorWeight) {
          for (const v of Object.values(d.rumorWeight)) {
            expect(v ?? 0, a.id).toBeGreaterThanOrEqual(0)
            expect(v ?? 0, a.id).toBeLessThanOrEqual(3)
          }
        }
      }
    }
  })

  it('has at least 6 always-eligible filler questions per speaker', () => {
    const driverFillers = PRESS_BANK.filter(q => q.contextTags.length === 0 && q.speaker === 'driver')
    const tpFillers = PRESS_BANK.filter(q => q.contextTags.length === 0 && q.speaker === 'team-principal')
    expect(driverFillers.length).toBeGreaterThanOrEqual(6)
    expect(tpFillers.length).toBeGreaterThanOrEqual(6)
  })

  it('coverage matrix met (reachable v1 rows only)', () => {
    const matrix: Array<[string, (q: typeof PRESS_BANK[0]) => boolean, number]> = [
      ['Thursday season-opener', q => q.speaker === 'driver' && q.contextTags.includes('season-opener'), 4],
      ['Thursday default', q => q.speaker === 'driver' && q.contextTags.length === 0, 8],
      ['Thursday contract-expiring', q => q.speaker === 'driver' && q.contextTags.includes('contract-expiring'), 4],
      ['Thursday home-race', q => q.speaker === 'driver' && q.contextTags.includes('home-race'), 3],
      ['Thursday driver-mood-low', q => q.speaker === 'driver' && q.contextTags.includes('driver-mood-low'), 2],
      ['Thursday driver-mood-high', q => q.speaker === 'driver' && q.contextTags.includes('driver-mood-high'), 2],
      ['Thursday budget-cap-pressure', q => q.speaker === 'driver' && q.contextTags.includes('budget-cap-pressure'), 3],
      ['Post-race podium', q => q.speaker === 'driver' && q.contextTags.includes('after-podium'), 6],
      ['Post-race points', q => q.speaker === 'driver' && q.contextTags.includes('after-points'), 5],
      ['Post-race zero-points', q => q.speaker === 'driver' && q.contextTags.includes('after-zero-points'), 4],
      ['Post-race DNF', q => q.speaker === 'driver' && q.contextTags.includes('after-dnf'), 4],
      ['Post-race teammate-beat-you', q => q.speaker === 'driver' && q.contextTags.includes('teammate-beat-you'), 4],
      ['Post-race beat-teammate', q => q.speaker === 'driver' && q.contextTags.includes('beat-teammate'), 4],
      ['Post-race season-finale', q => q.speaker === 'driver' && q.contextTags.includes('season-finale'), 3],
      ['TP default', q => q.speaker === 'team-principal' && q.contextTags.length === 0, 5],
    ]
    for (const [name, pred, min] of matrix) {
      const count = PRESS_BANK.filter(pred).length
      expect(count, `${name}: have ${count}, need ${min}`).toBeGreaterThanOrEqual(min)
    }
  })
})
