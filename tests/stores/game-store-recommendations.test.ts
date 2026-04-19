import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '@/stores/game-store'
import { createInitialRaceRuntime } from '@/stores/race-runtime-slice'
import { createRaceCommandBus } from '@/engine/race/race-command-bus'
import type { Recommendation } from '@/types/delegation'

const TEAM_ID = 'mclaren'
const DRIVER_ID = 'norris'

function resetStore() {
  useGameStore.setState({
    world: null,
    eventCooldowns: {},
    lastRaceResults: null,
    lastSeasonEnd: null,
    raceCommandBus: createRaceCommandBus(),
    raceRuntime: createInitialRaceRuntime(),
  })
}

function seedWorldWithRecs(recs: Recommendation[]) {
  useGameStore.getState().initGame(TEAM_ID, 'golden-era', 1)
  const { world } = useGameStore.getState()
  if (!world) throw new Error('init failed')
  useGameStore.setState({ world: { ...world, recommendations: recs } })
}

function makeRec(role: Recommendation['role'], action: string, applicable: boolean): Recommendation {
  return {
    id: `1:${role}`,
    role,
    department: role,
    action,
    description: `${role} says do ${action}`,
    applicable,
    status: 'active',
    generatedAtRound: 1,
  }
}

describe('applyRecommendation', () => {
  beforeEach(resetStore)

  it('marks a dismissable recommendation as dismissed', () => {
    seedWorldWithRecs([makeRec('technical-director', 'monitor', false)])
    useGameStore.getState().dismissRecommendation('1:technical-director')
    const rec = useGameStore.getState().world!.recommendations[0]
    expect(rec.status).toBe('dismissed')
  })

  it('start-rnd:<id> routes through the R&D path and marks applied', () => {
    const world = useGameStore.getState()
    world.initGame(TEAM_ID, 'golden-era', 1)
    const current = useGameStore.getState().world!
    const team = current.teams.find(t => t.id === TEAM_ID)!
    const available = team.rndUpgrades.find(u => u.status === 'available')!

    useGameStore.setState({
      world: {
        ...current,
        recommendations: [makeRec('technical-director', `start-rnd:${available.id}`, true)],
      },
    })

    useGameStore.getState().applyRecommendation('1:technical-director')
    const after = useGameStore.getState().world!
    const updatedTeam = after.teams.find(t => t.id === TEAM_ID)!
    const upgrade = updatedTeam.rndUpgrades.find(u => u.id === available.id)!
    expect(upgrade.status).toBe('in-progress')
    expect(after.recommendations[0].status).toBe('applied')
  })

  it('sponsor-outreach boosts lowest-satisfaction sponsor', () => {
    useGameStore.getState().initGame(TEAM_ID, 'golden-era', 1)
    const snapshot = useGameStore.getState().world!
    const before = snapshot.finance[TEAM_ID].sponsors
    const minIdx = before.reduce(
      (acc, s, i) => (s.satisfaction < before[acc].satisfaction ? i : acc),
      0,
    )
    const baseline = before[minIdx].satisfaction

    useGameStore.setState({
      world: {
        ...snapshot,
        recommendations: [makeRec('commercial-director', 'sponsor-outreach', true)],
      },
    })

    useGameStore.getState().applyRecommendation('1:commercial-director')
    const after = useGameStore.getState().world!.finance[TEAM_ID].sponsors
    expect(after[minIdx].satisfaction).toBe(Math.min(100, baseline + 10))
  })

  it('driver-talk:<id> reduces that driver\'s frustration by 20', () => {
    useGameStore.getState().initGame(TEAM_ID, 'golden-era', 1)
    const snapshot = useGameStore.getState().world!
    const patchedDrivers = snapshot.drivers.map(d =>
      d.id === DRIVER_ID ? { ...d, mood: { ...d.mood, frustration: 80 } } : d,
    )
    useGameStore.setState({
      world: {
        ...snapshot,
        drivers: patchedDrivers,
        recommendations: [makeRec('team-manager', `driver-talk:${DRIVER_ID}`, true)],
      },
    })

    useGameStore.getState().applyRecommendation('1:team-manager')
    const driver = useGameStore.getState().world!.drivers.find(d => d.id === DRIVER_ID)!
    expect(driver.mood.frustration).toBe(60)
  })

  it('strategy:1-stop:lap-<n> writes a staged strategy per player driver', () => {
    useGameStore.getState().initGame(TEAM_ID, 'golden-era', 1)
    const snapshot = useGameStore.getState().world!
    useGameStore.setState({
      world: {
        ...snapshot,
        recommendations: [makeRec('race-engineer', 'strategy:1-stop:lap-25', true)],
      },
    })

    useGameStore.getState().applyRecommendation('1:race-engineer')
    const staged = useGameStore.getState().world!.stagedStrategies
    const playerDriverIds = snapshot.drivers
      .filter(d => d.teamId === TEAM_ID && !d.isReserve)
      .map(d => d.id)

    expect(Object.keys(staged).sort()).toEqual(playerDriverIds.sort())
    for (const id of playerDriverIds) {
      expect(staged[id].stops).toHaveLength(1)
      expect(staged[id].stops[0].lap).toBe(25)
    }
  })

  it('is a no-op for an unknown recommendation id', () => {
    seedWorldWithRecs([makeRec('technical-director', 'monitor', false)])
    const before = useGameStore.getState().world!
    useGameStore.getState().applyRecommendation('ghost')
    const after = useGameStore.getState().world!
    expect(after).toBe(before)
  })

  it('is a no-op when the recommendation is not applicable', () => {
    seedWorldWithRecs([makeRec('technical-director', 'monitor', false)])
    const before = useGameStore.getState().world!.recommendations[0]
    useGameStore.getState().applyRecommendation('1:technical-director')
    const after = useGameStore.getState().world!.recommendations[0]
    expect(after.status).toBe(before.status)
  })
})
