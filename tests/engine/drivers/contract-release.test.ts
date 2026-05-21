import { describe, expect, it } from 'vitest'
import { computeSeverance, SEVERANCE_FRACTION } from '@/engine/drivers/contract-release'
import type { Contract } from '@/types/driver'
import { releaseDriver } from '@/engine/drivers/contract-release'
import { salariesSpent } from '@/engine/drivers/contract-engine'
import type { FullGameState } from '@/engine/core/state-manager'
import { initializeGame } from '@/engine/core/state-manager'

const contract = (overrides: Partial<Contract> = {}): Contract => ({
  salary: 20_000_000,
  termEndSeason: 2,
  performanceBonuses: [],
  releaseClause: null,
  ...overrides,
})

describe('computeSeverance', () => {
  it('returns the release clause when one is set', () => {
    expect(computeSeverance(contract({ releaseClause: 30_000_000 }))).toBe(30_000_000)
  })

  it('returns a fraction of remaining contract value when no clause', () => {
    // 20M salary × 2 seasons × 0.5 = 20M
    expect(computeSeverance(contract({ salary: 20_000_000, termEndSeason: 2 }))).toBe(
      Math.round(20_000_000 * 2 * SEVERANCE_FRACTION),
    )
  })

  it('rounds the fractional severance to an integer', () => {
    const result = computeSeverance(contract({ salary: 15_500_001, termEndSeason: 1 }))
    expect(Number.isInteger(result)).toBe(true)
  })

  it('a release clause of 0 is honored (not treated as "no clause")', () => {
    expect(computeSeverance(contract({ releaseClause: 0 }))).toBe(0)
  })

  it('final-season driver with no clause owes half a single season of salary', () => {
    // termEndSeason 1 = final season → 24M × 1 × 0.5 = 12M
    expect(computeSeverance(contract({ salary: 24_000_000, termEndSeason: 1 }))).toBe(12_000_000)
  })
})

const buildWorld = (): FullGameState => initializeGame('mclaren', 'golden-era', 42)
const cat = (w: FullGameState, name: string) =>
  w.finance['mclaren'].budget.categories.find((c) => c.name === name)!.spent

describe('releaseDriver', () => {
  it('moves the released driver to free agency', () => {
    const world = buildWorld()
    const driver = world.drivers.find((d) => d.teamId === 'mclaren' && !d.isReserve)!
    const { world: next, releasedDriver } = releaseDriver(world, 'mclaren', driver.id)
    const freed = next.drivers.find((d) => d.id === driver.id)!
    expect(freed.teamId).toBeNull()
    expect(freed.contract).toBeNull()
    expect(freed.isReserve).toBe(false)
    expect(releasedDriver.id).toBe(driver.id)
  })

  it('recomputes Salaries (drops) and charges severance to Operations', () => {
    const world = buildWorld()
    const driver = world.drivers.find((d) => d.teamId === 'mclaren' && !d.isReserve)!
    const opsBefore = cat(world, 'Operations')
    const { world: next, severance } = releaseDriver(world, 'mclaren', driver.id)
    expect(cat(next, 'Salaries')).toBe(salariesSpent(next.drivers, 'mclaren'))
    expect(cat(next, 'Operations')).toBe(opsBefore + severance)
  })

  it('does not mutate the input world (purity)', () => {
    const world = buildWorld()
    const driver = world.drivers.find((d) => d.teamId === 'mclaren' && !d.isReserve)!
    const snapshot = JSON.stringify(world)
    releaseDriver(world, 'mclaren', driver.id)
    expect(JSON.stringify(world)).toBe(snapshot)
  })

  it('is deterministic — same input produces deep-equal output', () => {
    const w1 = buildWorld()
    const w2 = buildWorld()
    const id = w1.drivers.find((d) => d.teamId === 'mclaren' && !d.isReserve)!.id
    expect(releaseDriver(w1, 'mclaren', id).world.drivers).toEqual(
      releaseDriver(w2, 'mclaren', id).world.drivers,
    )
  })

  it('releases a contracted reserve driver', () => {
    let world = buildWorld()
    const someReserve = world.drivers.find((d) => d.teamId === 'mclaren' && d.isReserve)
    if (!someReserve) {
      const fa = world.drivers.find((d) => d.teamId === null)!
      world = {
        ...world,
        drivers: world.drivers.map((d) =>
          d.id === fa.id
            ? { ...d, teamId: 'mclaren', isReserve: true, contract: { salary: 5_000_000, termEndSeason: 1, performanceBonuses: [], releaseClause: null } }
            : d,
        ),
      }
    }
    const reserve = world.drivers.find((d) => d.teamId === 'mclaren' && d.isReserve)!
    const { world: next } = releaseDriver(world, 'mclaren', reserve.id)
    expect(next.drivers.find((d) => d.id === reserve.id)!.teamId).toBeNull()
  })

  it('throws when the driver is not found', () => {
    const world = buildWorld()
    expect(() => releaseDriver(world, 'mclaren', 'nope')).toThrow(/not found/i)
  })

  it('throws when the driver is on another team', () => {
    const world = buildWorld()
    const other = world.drivers.find((d) => d.teamId && d.teamId !== 'mclaren')!
    expect(() => releaseDriver(world, 'mclaren', other.id)).toThrow(/team/i)
  })

  it('throws when the driver has no contract', () => {
    const world = buildWorld()
    const fa = world.drivers.find((d) => d.teamId === null)!
    expect(() => releaseDriver(world, 'mclaren', fa.id)).toThrow(/team|contract/i)
  })
})
