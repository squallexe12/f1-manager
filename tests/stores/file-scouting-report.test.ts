import 'fake-indexeddb/auto'
import { describe, expect, it, beforeEach } from 'vitest'
import { useGameStore } from '@/stores/game-store'
import type { FullGameState } from '@/engine/core/state-manager'

// Helper to get a fresh world with a free-agent driver injected
function worldWithFreeAgent(
  base: FullGameState,
  overrides: { scoutingReports?: number; teamId?: string | null } = {},
): FullGameState {
  // Use the existing drugovich driver (teamId: null, isReserve: true) or
  // inject a synthetic free agent entry
  const drivers = base.drivers.map(d => {
    if (d.id === 'drugovich') {
      return {
        ...d,
        isReserve: false,
        isF2: false,
        teamId: null as string | null,
        scoutingReports: overrides.scoutingReports ?? 0,
      }
    }
    return d
  })
  return { ...base, drivers }
}

function worldWithContractedDriver(base: FullGameState): FullGameState {
  // norris is contracted (teamId: 'mclaren', isF2: false)
  const drivers = base.drivers.map(d => {
    if (d.id === 'norris') {
      return { ...d, scoutingReports: 0 }
    }
    return d
  })
  return { ...base, drivers }
}

describe('fileScoutingReport store action', () => {
  beforeEach(() => {
    useGameStore.getState().initGame('mclaren', 'golden-era', 42)
  })

  it('increments scoutingReports on a free-agent driver', () => {
    const base = useGameStore.getState().world!
    useGameStore.setState({ world: worldWithFreeAgent(base) })

    useGameStore.getState().fileScoutingReport('drugovich')

    const after = useGameStore.getState().world!.drivers.find(d => d.id === 'drugovich')!
    expect(after.scoutingReports).toBe(1)
  })

  it('updates scoutSignal after enough reports', () => {
    const base = useGameStore.getState().world!
    // drugovich: pace 72, devPotential 40 — needs scoutingReports >=8 for hot
    // so put at 7 (one shy of hot)
    useGameStore.setState({ world: worldWithFreeAgent(base, { scoutingReports: 7 }) })

    useGameStore.getState().fileScoutingReport('drugovich')

    const after = useGameStore.getState().world!.drivers.find(d => d.id === 'drugovich')!
    expect(after.scoutingReports).toBe(8)
    expect(after.scoutSignal).toBe('hot')
  })

  it('no-ops on a contracted driver (gates eligibility)', () => {
    const base = useGameStore.getState().world!
    useGameStore.setState({ world: worldWithContractedDriver(base) })

    useGameStore.getState().fileScoutingReport('norris')

    const after = useGameStore.getState().world!.drivers.find(d => d.id === 'norris')!
    expect(after.scoutingReports).toBe(0)
  })

  it('does nothing when world is null', () => {
    useGameStore.setState({ world: null })
    expect(() => useGameStore.getState().fileScoutingReport('drugovich')).not.toThrow()
  })
})
