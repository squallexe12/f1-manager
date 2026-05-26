import { describe, it, expect } from 'vitest'
import { createPRNG } from '@/engine/core/prng'
import { evaluateRejoinCollision, DEFAULT_REJOIN_CONFIG } from '@/engine/race/rejoin-collision'

const input = (over: Partial<Parameters<typeof evaluateRejoinCollision>[0]> = {}) => ({
  driverId: 'drv-a',
  rejoinRisk: 'high' as 'low' | 'med' | 'high',
  racecraft: 70,
  config: DEFAULT_REJOIN_CONFIG,
  ...over,
})

describe('evaluateRejoinCollision', () => {
  it('is deterministic for a seed', () => {
    const a = evaluateRejoinCollision(input(), createPRNG(11))
    const b = evaluateRejoinCollision(input(), createPRNG(11))
    expect(a).toEqual(b)
  })

  it('returns a decision shaped like a contested-event decision when it fires', () => {
    // Find a seed that fires for a low-racecraft, high-risk rejoin.
    let fired: ReturnType<typeof evaluateRejoinCollision> | null = null
    for (let s = 1; s <= 200 && !fired?.decision; s++) {
      fired = evaluateRejoinCollision(input({ racecraft: 25, rejoinRisk: 'high' }), createPRNG(s))
    }
    expect(fired?.decision).not.toBeNull()
    expect(fired?.decision?.driverId).toBe('drv-a')
    expect(fired?.decision?.offenceType).toBe('rejoin-collision')
    expect(['minor', 'serious', 'major', 'egregious']).toContain(fired?.decision?.severity)
  })

  it('low rejoinRisk + high racecraft rarely causes a collision', () => {
    let fires = 0
    for (let s = 1; s <= 2000; s++) {
      if (evaluateRejoinCollision(input({ racecraft: 95, rejoinRisk: 'low' }), createPRNG(s)).decision) fires++
    }
    expect(fires).toBeLessThanOrEqual(40) // ≤ ~2%
  })
})
