import { describe, it, expect } from 'vitest'
import { evaluateObjective, type BoardContext } from '@/engine/board/board-objectives'
import type { BoardObjective } from '@/types/board'

const ctx = (over: Partial<BoardContext> = {}): BoardContext => ({
  constructorPosition: 5, constructorPoints: 100,
  rivalConstructorPosition: 4, rivalConstructorPoints: 120,
  currentRound: 11, totalRounds: 22, ...over,
})
const obj = (k: BoardObjective['kind'], target: number): BoardObjective =>
  ({ kind: k, label: '', target, weight: 1, current: 0, met: false })

describe('evaluateObjective', () => {
  it('pointsTarget is on-pace at half the season', () => {
    // 100 pts at round 11/22 vs target 200 → (100/200)/0.5 = 1.0
    const e = evaluateObjective(obj('pointsTarget', 200), ctx({ constructorPoints: 100 }))
    expect(e.current).toBe(100)
    expect(e.met).toBe(false)        // absolute 100 < 200
    expect(e.pace01).toBeCloseTo(1)  // but fully on pace
  })
  it('pointsTarget met when absolute target reached', () => {
    const e = evaluateObjective(obj('pointsTarget', 80), ctx({ constructorPoints: 100 }))
    expect(e.met).toBe(true)
    expect(e.pace01).toBe(1)
  })
  it('constructorFinish met when position at or better than target', () => {
    const e = evaluateObjective(obj('constructorFinish', 5), ctx({ constructorPosition: 4 }))
    expect(e.current).toBe(4)
    expect(e.met).toBe(true)
    expect(e.pace01).toBe(1)
  })
  it('constructorFinish partial credit when behind target', () => {
    const e = evaluateObjective(obj('constructorFinish', 5), ctx({ constructorPosition: 8 }))
    expect(e.met).toBe(false)
    expect(e.pace01).toBeCloseTo(4 / 7) // (12 - pos) / (12 - target) = (12-8)/(12-5)
  })
  it('constructorFinish treats unranked (0) as P11', () => {
    const e = evaluateObjective(obj('constructorFinish', 5), ctx({ constructorPosition: 0 }))
    expect(e.current).toBe(11)
    expect(e.met).toBe(false)
  })
  it('beatRival met when ahead of rival', () => {
    const e = evaluateObjective(obj('beatRival', 1), ctx({ constructorPosition: 3, rivalConstructorPosition: 5 }))
    expect(e.met).toBe(true)
    expect(e.current).toBe(1)
    expect(e.pace01).toBe(1)
  })
  it('beatRival softens when just behind rival', () => {
    const e = evaluateObjective(obj('beatRival', 1), ctx({ constructorPosition: 6, rivalConstructorPosition: 5 }))
    expect(e.met).toBe(false)
    expect(e.pace01).toBeCloseTo(0.75) // 1 - (6-5)*0.25
  })
})
