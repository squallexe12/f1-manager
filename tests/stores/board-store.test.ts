import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '@/stores/game-store'
import type { RaceResult } from '@/engine/core/post-race-processor'

describe('game store board pass-through', () => {
  beforeEach(() => {
    useGameStore.setState({ world: null })
    useGameStore.getState().initGame('mclaren', 'golden-era', 42)
  })

  it('submitRaceResults persists recomputed board confidence into world', () => {
    const world = useGameStore.getState().world!
    const currentRound = world.gameState.currentRound
    const results: RaceResult[] = world.drivers
      .filter(d => !d.isReserve)
      .map((d, i) => ({
        driverId: d.id,
        position: i + 1,
        dnf: false,
        fastestLap: false,
      }))

    useGameStore.getState().submitRaceResults(results, null, false)

    const board = useGameStore.getState().world!.boardExpectations
    expect(board.lastProcessedRound).toBe(currentRound)
    expect(board.confidenceHistory.length).toBe(1)
  })

  it('is idempotent — submitting the same round twice does not double-append confidence', () => {
    const world = useGameStore.getState().world!
    const results: RaceResult[] = world.drivers
      .filter(d => !d.isReserve)
      .map((d, i) => ({
        driverId: d.id,
        position: i + 1,
        dnf: false,
        fastestLap: false,
      }))

    // Both calls target the same round — the second must be blocked by the
    // lastProcessedRound guard. Do NOT advance the round between them or this
    // stops testing idempotency and becomes a two-round (double-append) test.
    useGameStore.getState().submitRaceResults(results, null, false)
    useGameStore.getState().submitRaceResults(results, null, false)

    const board = useGameStore.getState().world!.boardExpectations
    expect(board.confidenceHistory.length).toBe(1)
  })

  it('produces a new world reference after submitRaceResults (autosave trigger)', () => {
    const before = useGameStore.getState().world
    const results: RaceResult[] = before!.drivers
      .filter(d => !d.isReserve)
      .map((d, i) => ({ driverId: d.id, position: i + 1, dnf: false, fastestLap: false }))

    useGameStore.getState().submitRaceResults(results, null, false)

    expect(useGameStore.getState().world).not.toBe(before)
  })

  it('carries a non-sack verdict on lastSeasonEnd after the phase advances', () => {
    // Regression: the season-end screen gates on lastSeasonEnd, NOT phase — a
    // retain/warning verdict advances phase to 'management' immediately, so a
    // phase gate would hide those verdicts entirely. A target of P11 is always
    // met (player position ≤ 11) → outcomeScore 50 ≥ RETAIN_BAR → retain.
    const base = useGameStore.getState().world!
    const world = {
      ...base,
      gameState: { ...base.gameState, phase: 'season-end' as const },
      boardExpectations: {
        ...base.boardExpectations,
        objectives: base.boardExpectations.objectives.map(o =>
          o.kind === 'constructorFinish' ? { ...o, target: 11 } : o),
      },
    }
    useGameStore.setState({ world, lastSeasonEnd: null })
    useGameStore.getState().processSeasonEnd()

    const st = useGameStore.getState()
    expect(st.world!.gameState.phase).toBe('management')            // season advanced
    expect(st.lastSeasonEnd?.boardVerdict?.verdict).toBe('retain')  // verdict still reachable
  })

  it('clearSeasonEnd dismisses the season-end recap', () => {
    const base = useGameStore.getState().world!
    useGameStore.setState({
      world: { ...base, gameState: { ...base.gameState, phase: 'season-end' as const } },
      lastSeasonEnd: null,
    })
    useGameStore.getState().processSeasonEnd()
    expect(useGameStore.getState().lastSeasonEnd).not.toBeNull()

    useGameStore.getState().clearSeasonEnd()
    expect(useGameStore.getState().lastSeasonEnd).toBeNull()
  })
})
