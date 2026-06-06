import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('drops falsy/conditional values', () => {
    expect(cn('a', false && 'skip', undefined, null, 'c')).toBe('a c')
  })

  it('dedupes conflicting tailwind utilities (last wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })
})
