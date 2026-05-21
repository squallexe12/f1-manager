import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '@/stores/game-store'
import { salariesSpent } from '@/engine/drivers/contract-engine'
import type { ContractOffer } from '@/engine/drivers/contract-engine'
import { computeSeverance } from '@/engine/drivers/contract-release'

describe('signContract', () => {
  beforeEach(() => {
    useGameStore.setState({ world: null })
    useGameStore.getState().initGame('mclaren', 'golden-era', 42)
  })

  it('updates the driver contract from the offer', () => {
    const world = useGameStore.getState().world!
    const driver = world.drivers.find((d) => d.teamId === 'mclaren' && !d.isReserve)!
    const offer: ContractOffer = {
      salary: 25_000_000, termLength: 3,
      performanceBonuses: [{ condition: 'Win', value: 1_000_000 }],
      releaseClause: 50_000_000,
    }
    useGameStore.getState().signContract(driver.id, offer)

    const updated = useGameStore.getState().world!.drivers.find((d) => d.id === driver.id)!
    expect(updated.contract).toEqual({
      salary: 25_000_000, termEndSeason: 3,
      performanceBonuses: [{ condition: 'Win', value: 1_000_000 }],
      releaseClause: 50_000_000,
    })
  })

  it('recomputes the Salaries budget category from truth', () => {
    const w0 = useGameStore.getState().world!
    const driver = w0.drivers.find((d) => d.teamId === 'mclaren' && !d.isReserve)!
    const offer: ContractOffer = { salary: 99_000_000, termLength: 2, performanceBonuses: [], releaseClause: null }
    useGameStore.getState().signContract(driver.id, offer)

    const w1 = useGameStore.getState().world!
    const expected = salariesSpent(w1.drivers, 'mclaren')
    const salariesCat = w1.finance['mclaren'].budget.categories.find((c) => c.name === 'Salaries')!
    expect(salariesCat.spent).toBe(expected)
    expect(salariesCat.spent).toBeGreaterThanOrEqual(99_000_000)
  })

  it('produces a new world reference (autosave trigger)', () => {
    const before = useGameStore.getState().world
    const driver = before!.drivers.find((d) => d.teamId === 'mclaren' && !d.isReserve)!
    useGameStore.getState().signContract(driver.id, { salary: 10_000_000, termLength: 1, performanceBonuses: [], releaseClause: null })
    expect(useGameStore.getState().world).not.toBe(before)
  })
})

describe('releaseDriver action', () => {
  beforeEach(() => {
    useGameStore.setState({ world: null })
    useGameStore.getState().initGame('mclaren', 'golden-era', 42)
  })

  it('moves the driver to free agency and updates the budget', () => {
    const w0 = useGameStore.getState().world!
    const driver = w0.drivers.find((d) => d.teamId === 'mclaren' && !d.isReserve)!
    const opsBefore = w0.finance['mclaren'].budget.categories.find((c) => c.name === 'Operations')!.spent
    const severance = computeSeverance(driver.contract!)

    useGameStore.getState().releaseDriver(driver.id)

    const w1 = useGameStore.getState().world!
    const freed = w1.drivers.find((d) => d.id === driver.id)!
    expect(freed.teamId).toBeNull()
    expect(freed.contract).toBeNull()
    const ops = w1.finance['mclaren'].budget.categories.find((c) => c.name === 'Operations')!.spent
    expect(ops).toBe(opsBefore + severance)
  })

  it('produces a new world reference (autosave trigger)', () => {
    const before = useGameStore.getState().world
    const driver = before!.drivers.find((d) => d.teamId === 'mclaren' && !d.isReserve)!
    useGameStore.getState().releaseDriver(driver.id)
    expect(useGameStore.getState().world).not.toBe(before)
  })

  it('is a no-op when world is null', () => {
    useGameStore.setState({ world: null })
    expect(() => useGameStore.getState().releaseDriver('anyone')).not.toThrow()
    expect(useGameStore.getState().world).toBeNull()
  })
})
