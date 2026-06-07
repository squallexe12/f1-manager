import { describe, it, expect } from 'vitest'
import { createEmptyWeekendState, type WeekendState } from '@/types/weekend'

describe('createEmptyWeekendState', () => {
  it('returns an empty weekend bundle stamped with round + season', () => {
    const ws = createEmptyWeekendState(7, 2)
    expect(ws).toEqual<WeekendState>({
      round: 7,
      season: 2,
      tireLedger: { remaining: {} },
      driverSetup: {},
      practiceResults: [],
      qualifyingResult: null,
      sprintQualifyingResult: null,
    })
  })

  it('is JSON-serializable with no class/Date/Map/Set leakage', () => {
    const ws = createEmptyWeekendState(1, 1)
    expect(JSON.parse(JSON.stringify(ws))).toEqual(ws)
  })

  it('produces independent instances (no shared mutable references)', () => {
    const a = createEmptyWeekendState(1, 1)
    const b = createEmptyWeekendState(1, 1)
    a.practiceResults.push({
      sessionIndex: 0,
      programByDriver: {},
      driverResults: [],
      completedAt: 'x',
    })
    a.tireLedger.remaining.C5 = 3
    expect(b.practiceResults).toEqual([])
    expect(b.tireLedger.remaining).toEqual({})
  })
})
