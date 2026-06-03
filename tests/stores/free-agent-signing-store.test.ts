import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '@/stores/game-store'

describe('signFreeAgent store action', () => {
  beforeEach(() => {
    useGameStore.setState({ world: null })
    useGameStore.getState().initGame('mclaren', 'golden-era', 42)
  })

  it('signs a free agent into the empty RESERVE slot and updates roster + tuple', () => {
    const before = useGameStore.getState().world!
    const fa = before.drivers.find(d => d.teamId === null)!
    useGameStore.getState().signFreeAgent({
      driverId: fa.id,
      offer: { salary: 3_000_000, termYears: 1 },
      slotChoice: 'RESERVE',
      displaceDriverId: null,
    })
    const after = useGameStore.getState().world!
    const signed = after.drivers.find(d => d.id === fa.id)!
    expect(signed.teamId).toBe('mclaren')
    expect(signed.isReserve).toBe(true)
    expect(after.teams.find(t => t.id === 'mclaren')!.reserveDriverId).toBe(fa.id)
  })

  it('adds the new salary to the Salaries budget category', () => {
    const fa = useGameStore.getState().world!.drivers.find(d => d.teamId === null)!
    const salariesBefore = useGameStore.getState().world!
      .finance['mclaren'].budget.categories.find(c => c.name === 'Salaries')!.spent
    useGameStore.getState().signFreeAgent({
      driverId: fa.id, offer: { salary: 7_000_000, termYears: 2 },
      slotChoice: 'RESERVE', displaceDriverId: null,
    })
    const salariesAfter = useGameStore.getState().world!
      .finance['mclaren'].budget.categories.find(c => c.name === 'Salaries')!.spent
    expect(salariesAfter).toBeGreaterThan(salariesBefore)
  })
})
