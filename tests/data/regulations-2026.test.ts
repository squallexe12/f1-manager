import { describe, it, expect } from 'vitest'
import {
  REG_2026,
  REG_TERMS,
  regsForCard,
  type RegId,
  type RegTerm,
  type RegCardKey,
} from '@/data/regulations/2026-rules'

const ALL_REG_IDS: RegId[] = [
  'active-aero', 'no-mgu-h', 'hybrid-50-50', 'sustainable-fuel',
  'narrower-wheelbase', 'cost-cap-2026', 'cadillac-entry',
  'audi-entry', 'no-drs', 'pu-allocation-2026',
]
const ALL_TERMS: RegTerm[] = [
  'atr-coefficient', 'correlation-delta', 'wt-cfd',
  'ers', 'mgu-h', 'active-aero-mode', 'sustainable-fuel',
]

describe('REG_2026', () => {
  it('declares exactly the 10 RegId entries', () => {
    expect(Object.keys(REG_2026).sort()).toEqual([...ALL_REG_IDS].sort())
  })

  it('each entry has a non-empty ribbon ≤ 24 chars and briefing ≤ 240 chars', () => {
    for (const id of ALL_REG_IDS) {
      const entry = REG_2026[id]
      expect(entry.ribbon.length).toBeGreaterThan(0)
      expect(entry.ribbon.length).toBeLessThanOrEqual(24)
      expect(entry.briefing.length).toBeGreaterThan(0)
      expect(entry.briefing.length).toBeLessThanOrEqual(240)
    }
  })

  it('cards arrays contain only valid RegCardKey values', () => {
    const valid: RegCardKey[] = ['aero', 'power-unit', 'car-performance']
    for (const id of ALL_REG_IDS) {
      for (const card of REG_2026[id].cards) {
        expect(valid).toContain(card)
      }
    }
  })
})

describe('regsForCard', () => {
  it('aero card has 1 ribbon (active-aero)', () => {
    const regs = regsForCard('aero')
    expect(regs.map((r) => r.id)).toEqual(['active-aero'])
  })

  it('power-unit card has the 4 PU-related regs in declaration order', () => {
    const regs = regsForCard('power-unit')
    expect(regs.map((r) => r.id)).toEqual([
      'no-mgu-h', 'hybrid-50-50', 'sustainable-fuel', 'pu-allocation-2026',
    ])
  })

  it('car-performance card has 1 ribbon (narrower-wheelbase)', () => {
    expect(regsForCard('car-performance').map((r) => r.id)).toEqual([
      'narrower-wheelbase',
    ])
  })
})

describe('REG_TERMS', () => {
  it('declares exactly the 7 RegTerm entries with non-empty label and explainer', () => {
    expect(Object.keys(REG_TERMS).sort()).toEqual([...ALL_TERMS].sort())
    for (const term of ALL_TERMS) {
      const t = REG_TERMS[term]
      expect(t.label.length).toBeGreaterThan(0)
      expect(t.explainer.length).toBeGreaterThan(0)
    }
  })

  it('every seeAlso refers to a valid RegId', () => {
    for (const term of ALL_TERMS) {
      const ref = REG_TERMS[term].seeAlso
      if (ref) expect(REG_2026[ref]).toBeDefined()
    }
  })
})
