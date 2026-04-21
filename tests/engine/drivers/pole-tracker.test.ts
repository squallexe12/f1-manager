import { describe, it, expect } from 'vitest'
import { awardPole } from '@/engine/drivers/pole-tracker'
import { initializeGame } from '@/engine/core/state-manager'

describe('awardPole', () => {
  it('increments poles on the target driver only', () => {
    const world = initializeGame('mclaren', 'golden-era', 42)
    const next = awardPole(world.drivers, 'norris')
    const nor = next.find(d => d.id === 'norris')!
    const pia = next.find(d => d.id === 'piastri')!
    expect(nor.seasonStats.poles).toBe(1)
    expect(pia.seasonStats.poles).toBe(0)
  })

  it('does not mutate the input array', () => {
    const world = initializeGame('mclaren', 'golden-era', 42)
    const before = world.drivers.find(d => d.id === 'norris')!.seasonStats.poles
    awardPole(world.drivers, 'norris')
    const after = world.drivers.find(d => d.id === 'norris')!.seasonStats.poles
    expect(after).toBe(before)
  })

  it('is a no-op when the driver id does not match any row', () => {
    const world = initializeGame('mclaren', 'golden-era', 42)
    const next = awardPole(world.drivers, 'nonexistent')
    expect(next.every((d, i) => d.seasonStats.poles === world.drivers[i].seasonStats.poles)).toBe(true)
  })
})
