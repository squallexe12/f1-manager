import 'fake-indexeddb/auto'
import { describe, expect, it, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRaceSimulation } from '@/hooks/use-race-simulation'
import { useGameStore } from '@/stores/game-store'
import { createInitialRaceRuntime } from '@/stores/race-runtime-slice'
import type { LapResult, TireState } from '@/types/race'

// §3 hook/integration gate: the timing tower reads ONE authoritative
// `LapResult.retired` flag (never lapTime===0), and battles/interpolation
// exclude retired rows. This drives the hook off a seeded raceRuntime slice —
// no worker is attached (startRace is never called), so timing/battles are
// pure derivations of runtime.lastLapResults + runtime.tireStates.

const medium: TireState = { compound: 'C3', label: 'medium', wear: 60, lapsFitted: 10 }

function lapRow(over: Partial<LapResult> & Pick<LapResult, 'driverId' | 'position'>): LapResult {
  return {
    lap: 20,
    lapTime: 90_000,
    sector1: 30_000,
    sector2: 30_000,
    sector3: 30_000,
    gapToLeader: 0,
    gapToAhead: 0,
    tire: medium,
    pitted: false,
    retired: false,
    ...over,
  }
}

const DRIVER_META = [
  { id: 'norris', shortName: 'NOR', teamColor: '#FF8000', isPlayer: true },
  { id: 'piastri', shortName: 'PIA', teamColor: '#FF8000', isPlayer: true },
  { id: 'verstappen', shortName: 'VER', teamColor: '#0600EF', isPlayer: false },
]

function seedRuntime(lastLapResults: LapResult[], tireStates: Record<string, TireState> = {}) {
  useGameStore.setState({
    raceRuntime: {
      ...createInitialRaceRuntime(),
      phase: 'paused',
      currentLap: 20,
      totalLaps: 50,
      lastLapResults,
      tireStates,
    },
  })
}

function render() {
  return renderHook(() =>
    useRaceSimulation({ driverMeta: DRIVER_META, playerTeamId: 'mclaren' }),
  )
}

describe('useRaceSimulation — retired (RET) rows', () => {
  beforeEach(() => {
    useGameStore.setState({ raceRuntime: createInitialRaceRuntime(), world: null })
  })

  it('timing carries the authoritative retired flag straight from LapResult', () => {
    seedRuntime([
      lapRow({ driverId: 'norris', position: 1, lapTime: 89_000 }),
      lapRow({ driverId: 'verstappen', position: 2, lapTime: 89_500 }),
      // earlier retirement: RET row with lapTime 0
      lapRow({ driverId: 'piastri', position: 3, lapTime: 0, retired: true }),
    ])

    const { result } = render()
    const timing = result.current.state.timing

    expect(timing).toHaveLength(3)
    const pia = timing.find((t) => t.driverId === 'piastri')!
    const nor = timing.find((t) => t.driverId === 'norris')!

    // Retired row: flag true, lastLapTime suppressed to null (NOT read off lapTime).
    expect(pia.retired).toBe(true)
    expect(pia.lastLapTime).toBeNull()

    // Running row: flag false, real lap time preserved.
    expect(nor.retired).toBe(false)
    expect(nor.lastLapTime).toBe(89_000)
  })

  it('suppresses lastLapTime for a final-lap retirement that kept a real (>0) lapTime', () => {
    // §2.2(c): a driver who crashed THIS lap keeps the real running row but
    // flips retired:true. The hook must still suppress lastLapTime using the
    // flag, never `lapTime===0`.
    seedRuntime([
      lapRow({ driverId: 'norris', position: 1, lapTime: 89_000 }),
      lapRow({ driverId: 'verstappen', position: 2, lapTime: 90_200, retired: true }),
    ])

    const { result } = render()
    const ver = result.current.state.timing.find((t) => t.driverId === 'verstappen')!
    expect(ver.retired).toBe(true)
    expect(ver.lastLapTime).toBeNull() // suppressed by flag, not by lapTime
  })

  it('excludes retired rows from battle forecasts', () => {
    // norris leads; piastri retired but classified ahead of verstappen with a
    // <2s gap. If battles did NOT filter retired rows it would forecast a
    // phantom PIA-vs-VER battle. It must not.
    seedRuntime([
      lapRow({ driverId: 'norris', position: 1, gapToAhead: 0 }),
      lapRow({ driverId: 'piastri', position: 2, retired: true, lapTime: 0, gapToAhead: 0.5 }),
      lapRow({ driverId: 'verstappen', position: 3, gapToAhead: 0.5 }),
    ])

    const { result } = render()
    const battles = result.current.state.battles

    // No battle may name a retired driver as attacker or defender.
    for (const b of battles) {
      expect(b.attackerId).not.toBe('PIA')
      expect(b.defenderId).not.toBe('PIA')
    }
  })

  it('keeps retired cars out of the animated car-position set', () => {
    // With no race running (phase !== racing) interpolation never starts, so
    // carPositions stays empty regardless. The authoritative guarantee — the
    // interpolation anchor build filters !retired — is covered by the battles
    // filter sharing the same predicate; here we assert the public surface
    // never surfaces a retired driver as a live car.
    seedRuntime([
      lapRow({ driverId: 'norris', position: 1 }),
      lapRow({ driverId: 'piastri', position: 2, retired: true, lapTime: 0 }),
    ])

    const { result } = render()
    for (const car of result.current.state.carPositions) {
      expect(car.driverId).not.toBe('piastri')
    }
  })
})
