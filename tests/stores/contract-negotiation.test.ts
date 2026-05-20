import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '@/stores/game-store'
import { salariesSpent } from '@/engine/drivers/contract-engine'
import type { ContractOffer } from '@/engine/drivers/contract-engine'

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
