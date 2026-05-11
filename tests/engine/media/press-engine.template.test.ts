import { describe, expect, it } from 'vitest'
import { resolveTemplate, findUnknownPlaceholders, type TemplateContext } from '@/engine/media/templates'
import type { PressQuestion } from '@/types/media'

const baseQuestion = (template: string): PressQuestion => ({
  id: 'q1',
  contextTags: [],
  speaker: 'driver',
  outlet: 'Sky F1',
  journalist: 'Ted Kravitz',
  template,
  weight: 1,
  answers: [],
})

const baseCtx = (overrides: Partial<TemplateContext> = {}): TemplateContext => ({
  driverName: 'Lando Norris',
  teamName: 'McLaren',
  position: 3,
  circuit: 'Monaco',
  teammateName: 'Oscar Piastri',
  rivalTeamName: 'Ferrari',
  seasonYear: 2026,
  ...overrides,
})

describe('resolveTemplate', () => {
  it('replaces {driverName}', () => {
    const r = resolveTemplate(baseQuestion('Hello, {driverName}.'), baseCtx())
    expect(r.text).toBe('Hello, Lando Norris.')
  })

  it('replaces {teamName}', () => {
    const r = resolveTemplate(baseQuestion('{teamName} had a great race.'), baseCtx())
    expect(r.text).toBe('McLaren had a great race.')
  })

  it('replaces {position}', () => {
    const r = resolveTemplate(baseQuestion('You finished P{position} today.'), baseCtx())
    expect(r.text).toBe('You finished P3 today.')
  })

  it('replaces {position} when value is DNF', () => {
    const r = resolveTemplate(
      baseQuestion('You had a {position} today.'),
      baseCtx({ position: 'DNF' }),
    )
    expect(r.text).toBe('You had a DNF today.')
  })

  it('replaces {circuit}', () => {
    const r = resolveTemplate(baseQuestion('How do you feel about {circuit}?'), baseCtx())
    expect(r.text).toBe('How do you feel about Monaco?')
  })

  it('replaces {teammateName}', () => {
    const r = resolveTemplate(
      baseQuestion('{teammateName} beat you in qualifying today.'),
      baseCtx(),
    )
    expect(r.text).toBe('Oscar Piastri beat you in qualifying today.')
  })

  it('replaces {rivalTeamName}', () => {
    const r = resolveTemplate(
      baseQuestion('What do you make of {rivalTeamName}\'s pace?'),
      baseCtx(),
    )
    expect(r.text).toBe('What do you make of Ferrari\'s pace?')
  })

  it('replaces {seasonYear}', () => {
    const r = resolveTemplate(
      baseQuestion('Looking ahead to {seasonYear}, what are your goals?'),
      baseCtx(),
    )
    expect(r.text).toBe('Looking ahead to 2026, what are your goals?')
  })

  it('leaves unknown placeholders intact', () => {
    const r = resolveTemplate(baseQuestion('Hello {unknown}.'), baseCtx())
    expect(r.text).toBe('Hello {unknown}.')
  })

  it('replaces all occurrences of the same placeholder (regex-g pattern)', () => {
    const r = resolveTemplate(
      baseQuestion('Did {driverName} mean it, {driverName}?'),
      baseCtx(),
    )
    expect(r.text).toBe('Did Lando Norris mean it, Lando Norris?')
  })

  it('preserves question metadata on resolved output', () => {
    const q = baseQuestion('{driverName} answered.')
    const r = resolveTemplate(q, baseCtx())
    expect(r.id).toBe(q.id)
    expect(r.questionId).toBe(q.id)
    expect(r.outlet).toBe(q.outlet)
    expect(r.journalist).toBe(q.journalist)
    expect(r.answers).toBe(q.answers)
  })
})

describe('findUnknownPlaceholders', () => {
  it('returns empty array when all placeholders are known', () => {
    const result = findUnknownPlaceholders('{driverName} raced at {circuit}.')
    expect(result).toEqual([])
  })

  it('returns unknown placeholder tokens', () => {
    const result = findUnknownPlaceholders('Hello {unknown} and {alsoUnknown}.')
    expect(result).toContain('{unknown}')
    expect(result).toContain('{alsoUnknown}')
    expect(result).toHaveLength(2)
  })

  it('returns mixed findings — known are excluded, unknowns are returned', () => {
    const result = findUnknownPlaceholders('{driverName} uses {mysteryField}.')
    expect(result).toEqual(['{mysteryField}'])
  })

  it('returns empty array for a template with no placeholders', () => {
    const result = findUnknownPlaceholders('No placeholders here.')
    expect(result).toEqual([])
  })
})
