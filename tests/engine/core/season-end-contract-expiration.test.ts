import { describe, it, expect, beforeAll } from 'vitest'
import { initializeGame } from '@/engine/core/state-manager'
import { processSeasonEnd } from '@/engine/core/season-end-processor'
import type { Driver } from '@/types/driver'

// `termEndSeason` is RELATIVE: seasons remaining, where 1 means "expires at
// end of the current season" (see src/types/driver.ts). processSeasonEnd must
// expire a contract when it reaches its final season and otherwise decrement
// the survivor. A real, fully-formed driver is used so aging/pulse/career
// helpers inside processSeasonEnd run against valid state; only termEndSeason
// is overridden per scenario. initializeGame runs in beforeAll (not at module
// top level) so module-init hydration has completed before it is called.

function runOnce(driver: Driver, currentSeason: number): Driver {
  const result = processSeasonEnd([], [driver], {}, currentSeason)
  return result.drivers.find((d) => d.id === driver.id)!
}

describe('processSeasonEnd — driver contract expiration (relative termEndSeason)', () => {
  let baseDriver: Driver

  beforeAll(() => {
    const world = initializeGame('mclaren', 'golden-era', 1234)
    baseDriver = world.drivers.find((d) => d.contract && !d.isReserve && d.teamId !== null)!
  })

  function withTerm(term: number): Driver {
    return { ...baseDriver, contract: { ...baseDriver.contract!, termEndSeason: term } }
  }

  it('expires a contract in its final season (termEndSeason === 1)', () => {
    const after = runOnce(withTerm(1), 0)
    expect(after.contract).toBeNull()
  })

  it('decrements a multi-season contract rather than leaving it unchanged', () => {
    const after = runOnce(withTerm(3), 0)
    expect(after.contract?.termEndSeason).toBe(2)
  })

  it('does not void a freshly-signed multi-year deal in a late season', () => {
    // Regression: the old `termEndSeason <= currentSeason` check voided a
    // 2-year deal signed in season 5 immediately. With relative semantics it
    // must survive and decrement.
    const after = runOnce(withTerm(2), 5)
    expect(after.contract).not.toBeNull()
    expect(after.contract?.termEndSeason).toBe(1)
  })

  it('counts a contract down to expiry across consecutive seasons', () => {
    // Season 0 end: 2 -> 1 (still under contract)
    const afterS0 = runOnce(withTerm(2), 0)
    expect(afterS0.contract?.termEndSeason).toBe(1)
    // Season 1 end: 1 -> expires
    const afterS1 = runOnce(afterS0, 1)
    expect(afterS1.contract).toBeNull()
  })

  it('does not mutate the input driver contract (engine purity)', () => {
    const input = withTerm(3)
    runOnce(input, 0)
    expect(input.contract?.termEndSeason).toBe(3)
  })
})
