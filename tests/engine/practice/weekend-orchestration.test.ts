import { describe, it, expect } from 'vitest'
import { prepareWeekend, processPracticeExit } from '@/engine/core/orchestrator'
import {
  defaultDriverSetup,
  neutralDriverSetup,
  DEFAULT_WEEKEND_TIRE_SETS,
} from '@/engine/practice/practice-engine'
import { createEmptyWeekendState } from '@/types/weekend'
import type { FullGameState } from '@/engine/core/state-manager'

function circuit(compounds: [string, string, string]) {
  return {
    id: 'c', name: 'Test', country: 'X', laps: 50, downforceLevel: 'medium',
    tireWear: 'medium', overtakingDifficulty: 'medium', weatherVariability: 'medium',
    sectorCount: 3, compounds,
  }
}

function makeState(overrides: Partial<FullGameState> = {}): FullGameState {
  return {
    gameState: { currentRound: 5, season: 2, playerTeamId: 'mclaren', seed: 999, phase: 'practice', scenario: 'x', totalRaces: 22 },
    calendar: Array.from({ length: 22 }, (_, i) => ({
      id: `r${i + 1}`, name: `R${i + 1}`, round: i + 1, isSprint: false,
      circuit: circuit(['C2', 'C3', 'C4']), // hardest C2, medium C3, softest C4
    })),
    teams: [{ id: 'mclaren' }, { id: 'ferrari' }],
    drivers: [
      { id: 'norris', teamId: 'mclaren', isReserve: false, isF2: false },
      { id: 'piastri', teamId: 'mclaren', isReserve: false, isF2: false },
      { id: 'mcl-res', teamId: 'mclaren', isReserve: true, isF2: false },
      { id: 'leclerc', teamId: 'ferrari', isReserve: false, isF2: false },
    ],
    weekendState: createEmptyWeekendState(1, 1),
    ...overrides,
  } as unknown as FullGameState
}

describe('prepareWeekend', () => {
  it('seeds the tire ledger positionally from circuit.compounds (hard/medium/soft)', () => {
    const ws = prepareWeekend(makeState()).weekendState
    expect(ws.tireLedger.remaining).toEqual({
      C2: DEFAULT_WEEKEND_TIRE_SETS.hard,
      C3: DEFAULT_WEEKEND_TIRE_SETS.medium,
      C4: DEFAULT_WEEKEND_TIRE_SETS.soft,
    })
  })

  it('sets player racers to the default baseline and everyone else to neutral 50/50', () => {
    const ws = prepareWeekend(makeState()).weekendState
    expect(ws.driverSetup.norris).toEqual(defaultDriverSetup('norris'))
    expect(ws.driverSetup.piastri).toEqual(defaultDriverSetup('piastri'))
    expect(ws.driverSetup['mcl-res']).toEqual(neutralDriverSetup('mcl-res')) // player reserve = not racing
    expect(ws.driverSetup.leclerc).toEqual(neutralDriverSetup('leclerc')) // AI team
  })

  it('stamps round/season and resets results to empty (clears a stale weekend)', () => {
    const stale = makeState()
    ;(stale.weekendState as { qualifyingResult: unknown }).qualifyingResult = { junk: true }
    ;(stale.weekendState.practiceResults as unknown[]).push({ junk: true })
    const ws = prepareWeekend(stale).weekendState
    expect(ws.round).toBe(5)
    expect(ws.season).toBe(2)
    expect(ws.practiceResults).toEqual([])
    expect(ws.qualifyingResult).toBeNull()
    expect(ws.sprintQualifyingResult).toBeNull()
  })

  it('is pure — does not mutate the input state', () => {
    const state = makeState()
    const before = JSON.stringify(state)
    prepareWeekend(state)
    expect(JSON.stringify(state)).toBe(before)
  })
})

describe('processPracticeExit', () => {
  it('fills the skip-default for a player racer who ran no sessions, leaves runners untouched', () => {
    const state = prepareWeekend(makeState())
    // norris "ran" sessions -> custom accumulated setup; piastri never ran but got mangled.
    state.weekendState.driverSetup.norris = { driverId: 'norris', setupConfidence: 82, tireDegRead: 71, sessionsCompleted: 3 }
    state.weekendState.driverSetup.piastri = { driverId: 'piastri', setupConfidence: 0, tireDegRead: 0, sessionsCompleted: 0 }
    const ws = processPracticeExit(state).weekendState
    expect(ws.driverSetup.norris).toEqual({ driverId: 'norris', setupConfidence: 82, tireDegRead: 71, sessionsCompleted: 3 })
    expect(ws.driverSetup.piastri).toEqual(defaultDriverSetup('piastri'))
  })

  it('does not touch AI drivers and is pure', () => {
    const state = prepareWeekend(makeState())
    const before = JSON.stringify(state)
    const ws = processPracticeExit(state).weekendState
    expect(ws.driverSetup.leclerc).toEqual(neutralDriverSetup('leclerc'))
    expect(JSON.stringify(state)).toBe(before) // input not mutated
  })
})
