import { describe, it, expect } from 'vitest'
import { pushForm, FORM_WINDOW, FORM_DNF } from '@/engine/drivers/form-history'

describe('pushForm', () => {
  it('appends a new sample when window is not full', () => {
    expect(pushForm([1, 2, 3], 4)).toEqual([1, 2, 3, 4])
  })

  it('caps the window at FORM_WINDOW entries', () => {
    const full = Array.from({ length: FORM_WINDOW }, (_, i) => i + 1)
    const next = pushForm(full, 99)
    expect(next).toHaveLength(FORM_WINDOW)
    expect(next[0]).toBe(2)
    expect(next[next.length - 1]).toBe(99)
  })

  it('does not mutate the input array', () => {
    const input = [3, 2, 1]
    const frozen = Object.freeze([...input])
    pushForm(frozen, 4)
    expect(input).toEqual([3, 2, 1])
  })

  it('FORM_DNF is a sentinel value distinguishable from real positions', () => {
    expect(FORM_DNF).toBeGreaterThan(20)
  })
})
