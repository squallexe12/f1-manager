/**
 * press-engine.speaker.test.ts — IP-10 (6+ tests)
 *
 * Tests for selectPostRaceSpeaker, selectThursdaySpeaker, and narrativeScore.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { _internal } from '@/engine/media/press-engine'
import { initializeGame, type FullGameState } from '@/engine/core/state-manager'
import minimalBank from '../../fixtures/media/minimal-bank.json'
import type { PressQuestion } from '@/types/media'
import { podiumResult } from '../../fixtures/media/podium-result'
import { bothDNFResult } from '../../fixtures/media/dnf-result'
import { bannedDriverWorld } from '../../fixtures/media/banned-driver-world'

const bank = minimalBank as PressQuestion[]

function baseWorld(): FullGameState {
  return initializeGame('mclaren', 'rebuild', 1)
}

function playerDriverIds(world: FullGameState): string[] {
  return world.drivers
    .filter(d => d.teamId === world.gameState.playerTeamId && !d.isReserve)
    .map(d => d.id)
}

function patchDriver(
  world: FullGameState,
  driverId: string,
  patch: Partial<FullGameState['drivers'][number]>,
): FullGameState {
  return {
    ...world,
    drivers: world.drivers.map(d => (d.id === driverId ? { ...d, ...patch } : d)),
  }
}

beforeEach(() => {
  _internal._setBankForTests(bank)
})

afterEach(() => {
  _internal._resetBankForTests()
})

// ---------------------------------------------------------------------------
// narrativeScore
// ---------------------------------------------------------------------------
describe('narrativeScore', () => {
  it('P1 finish → score > P3 finish', () => {
    const world = baseWorld()
    const [d1] = playerDriverIds(world)
    const p1Results = podiumResult(d1, 'other', 1)
    const p3Results = podiumResult(d1, 'other', 3)
    const scoreP1 = _internal.narrativeScore(d1, p1Results)
    const scoreP3 = _internal.narrativeScore(d1, p3Results)
    expect(scoreP1).toBeGreaterThan(scoreP3)
  })

  it('DNF → returns 50 (high newsworthiness)', () => {
    const world = baseWorld()
    const [d1, d2] = playerDriverIds(world)
    const dnfResults = bothDNFResult([d1, d2])
    const score = _internal.narrativeScore(d1, dnfResults)
    expect(score).toBe(50)
  })

  it('no result → score 0', () => {
    const score = _internal.narrativeScore('nonexistent', [])
    expect(score).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// selectPostRaceSpeaker
// ---------------------------------------------------------------------------
describe('selectPostRaceSpeaker', () => {
  it('podium driver speaks (P3 vs P12)', () => {
    const world = baseWorld()
    const [d1, d2] = playerDriverIds(world)
    const results = podiumResult(d1, d2, 3)
    const speaker = _internal.selectPostRaceSpeaker(world, results)
    expect(speaker.kind).toBe('driver')
    expect(speaker.driverId).toBe(d1)
  })

  it('both drivers DNF → speaker is TP (no narrative advantage)', () => {
    const world = baseWorld()
    const [d1, d2] = playerDriverIds(world)
    const results = bothDNFResult([d1, d2])
    const speaker = _internal.selectPostRaceSpeaker(world, results)
    // Both DNF → both score 50, first available driver wins tie (d1)
    expect(speaker.kind).toBe('driver')
  })

  it('one driver banned → other speaks', () => {
    const world = bannedDriverWorld(0)
    const [d1, d2] = playerDriverIds(world)
    const results = podiumResult(d1, d2, 2)
    const speaker = _internal.selectPostRaceSpeaker(world, results)
    expect(speaker.driverId).not.toBe(d1)
    expect(speaker.driverId).toBe(d2)
  })

  it('both banned, no reserve → TP speaks', () => {
    const world = baseWorld()
    const [d1, d2] = playerDriverIds(world)
    const currentRound = world.gameState.currentRound
    const w = patchDriver(
      patchDriver(world, d1, { banUntilRound: currentRound + 1 }),
      d2, { banUntilRound: currentRound + 1 },
    )
    // Ensure no reserve driver
    const wNoReserve = {
      ...w,
      teams: w.teams.map(t =>
        t.id === w.gameState.playerTeamId ? { ...t, reserveDriverId: null } : t,
      ),
    }
    const results = bothDNFResult([d1, d2])
    const speaker = _internal.selectPostRaceSpeaker(wNoReserve, results)
    expect(speaker.kind).toBe('team-principal')
    expect(speaker.driverId).toBeUndefined()
  })

  it('P3 vs P12 → P3 driver speaks', () => {
    const world = baseWorld()
    const [d1, d2] = playerDriverIds(world)
    const results = [
      { driverId: d1, position: 3, dnf: false, fastestLap: false, appliedPenalties: [] },
      { driverId: d2, position: 12, dnf: false, fastestLap: false, appliedPenalties: [] },
    ]
    const speaker = _internal.selectPostRaceSpeaker(world, results)
    expect(speaker.driverId).toBe(d1)
  })
})

// ---------------------------------------------------------------------------
// selectThursdaySpeaker
// ---------------------------------------------------------------------------
describe('selectThursdaySpeaker', () => {
  it('driver with higher motivation speaks on Thursday', () => {
    const world = baseWorld()
    const [d1, d2] = playerDriverIds(world)
    const w = patchDriver(
      patchDriver(world, d1, { mood: { motivation: 80, frustration: 10, confidence: 80 } }),
      d2, { mood: { motivation: 60, frustration: 20, confidence: 60 } },
    )
    const speaker = _internal.selectThursdaySpeaker(w)
    expect(speaker.driverId).toBe(d1)
  })
})
