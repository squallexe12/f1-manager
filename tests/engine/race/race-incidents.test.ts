import { describe, it, expect } from 'vitest'
import { createPRNG } from '@/engine/core/prng'
import { mixSeed } from '@/engine/race/race-incidents'

// NOTE: the import above grows one function per task (evaluateCrash in Task 2,
// evaluateMechanical in Task 3, rollLapIncidents/cautionFromIncidents + the
// RaceIncidentConfig/IncidentRoll types in Task 4). Importing them before they
// exist would fail `tsc --noEmit`, so each task adds its own import.

describe('mixSeed', () => {
  it('is deterministic for the same (raceSeed, lap)', () => {
    expect(mixSeed(1000, 7)).toBe(mixSeed(1000, 7))
  })

  it('produces a 32-bit integer', () => {
    const s = mixSeed(1000, 7)
    expect(Number.isInteger(s)).toBe(true)
    expect(s).toBe(s | 0)
  })

  it('changes with the lap (so each lap gets its own incident PRNG)', () => {
    expect(mixSeed(1000, 1)).not.toBe(mixSeed(1000, 2))
  })

  it('changes with the race seed', () => {
    expect(mixSeed(1000, 1)).not.toBe(mixSeed(1001, 1))
  })
})
