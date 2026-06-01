import { describe, it, expect } from 'vitest'
import { processPostRace, type RaceResult } from '@/engine/core/post-race-processor'
import { createPRNG } from '@/engine/core/prng'
import { initializeGame } from '@/engine/core/state-manager'

describe('processPostRace — idempotency guard', () => {
  it('does not double-count stats when submitted twice for the same round', () => {
    const world = initializeGame('mclaren', 'golden-era', 1)
    const activeIds = world.drivers
      .filter(d => d.teamId && !d.isReserve && !d.isF2)
      .map(d => d.id)

    const results: RaceResult[] = [
      { driverId: 'norris', position: 1, dnf: false, fastestLap: true },
      { driverId: 'piastri', position: 2, dnf: false, fastestLap: false },
      ...activeIds
        .filter(id => id !== 'norris' && id !== 'piastri')
        .map((id, i) => ({ driverId: id, position: i + 3, dnf: false, fastestLap: false })),
    ]

    const firstPass = processPostRace(
      world.teams, world.drivers, world.finance,
      [], {}, results, null, false, 1,
      world.gameState.season,
      'mclaren', createPRNG(5),
    )

    // Re-submitting the same round's results must be a no-op on stats.
    const secondPass = processPostRace(
      firstPass.teams, firstPass.drivers, firstPass.finance,
      firstPass.narrativeEvents, firstPass.eventCooldowns,
      results, null, false, 1,
      world.gameState.season,
      'mclaren', createPRNG(5),
    )

    const firstNor = firstPass.drivers.find(d => d.id === 'norris')!
    const secondNor = secondPass.drivers.find(d => d.id === 'norris')!
    expect(secondNor.seasonStats.points).toBe(firstNor.seasonStats.points)
    expect(secondNor.seasonStats.wins).toBe(firstNor.seasonStats.wins)
    expect(secondNor.seasonStats.podiums).toBe(firstNor.seasonStats.podiums)
    expect(secondNor.form).toEqual(firstNor.form)

    const firstTeam = firstPass.teams.find(t => t.id === 'mclaren')!
    const secondTeam = secondPass.teams.find(t => t.id === 'mclaren')!
    expect(secondTeam.seasonForm).toEqual(firstTeam.seasonForm)
    expect(secondTeam.previousConstructorPosition).toBe(firstTeam.previousConstructorPosition)
  })
})

describe('processPostRace — Paddock hero fields', () => {
  it('snapshots previous constructor position before assigning the new one', () => {
    const world = initializeGame('mclaren', 'golden-era', 1)
    // Seed a pre-existing standings state so the delta is observable
    const preTeams = world.teams.map((t, i) => ({
      ...t,
      constructorPosition: i + 1,
    }))

    const results: RaceResult[] = world.drivers
      .filter(d => d.teamId && !d.isReserve && !d.isF2)
      .map((d, i) => ({ driverId: d.id, position: i + 1, dnf: false, fastestLap: false }))

    const update = processPostRace(
      preTeams, world.drivers, world.finance,
      [], {}, results, null, false, 2,
      world.gameState.season,
      'mclaren',
      createPRNG(7),
    )

    for (const team of update.teams) {
      const prior = preTeams.find(t => t.id === team.id)!
      expect(team.previousConstructorPosition).toBe(prior.constructorPosition)
      expect(team.previousMorale).toBe(prior.morale)
    }
  })

  it('pushes the new constructor position onto seasonForm', () => {
    const world = initializeGame('mclaren', 'golden-era', 1)
    const results: RaceResult[] = world.drivers
      .filter(d => d.teamId && !d.isReserve && !d.isF2)
      .map((d, i) => ({ driverId: d.id, position: i + 1, dnf: false, fastestLap: false }))

    const update = processPostRace(
      world.teams, world.drivers, world.finance,
      [], {}, results, null, false, 1,
      world.gameState.season,
      'mclaren',
      createPRNG(1),
    )

    for (const team of update.teams) {
      expect(team.seasonForm).toHaveLength(1)
      expect(team.seasonForm[0]).toBe(team.constructorPosition)
    }
  })

  it('records driver form, lastRaceResult, and DNF sentinel', () => {
    const world = initializeGame('mclaren', 'golden-era', 1)
    const norrisId = 'norris'
    const piastriId = 'piastri'
    const otherIds = world.drivers
      .filter(d => d.teamId && !d.isReserve && !d.isF2 && d.id !== norrisId && d.id !== piastriId)
      .map(d => d.id)

    const results: RaceResult[] = [
      { driverId: norrisId, position: 1, dnf: false, fastestLap: true },
      { driverId: piastriId, position: 20, dnf: true, fastestLap: false },
      ...otherIds.map((id, i) => ({ driverId: id, position: i + 2, dnf: false, fastestLap: false })),
    ]

    const update = processPostRace(
      world.teams, world.drivers, world.finance,
      [], {}, results, null, false, 1,
      world.gameState.season,
      'mclaren',
      createPRNG(3),
    )

    const nor = update.drivers.find(d => d.id === norrisId)!
    const pia = update.drivers.find(d => d.id === piastriId)!
    expect(nor.form).toEqual([1])
    expect(nor.lastRaceResult).toBe(1)
    expect(pia.form).toEqual([21]) // FORM_DNF sentinel
    expect(pia.lastRaceResult).toBeNull()
  })

  it('grants no points/podium/win/mood to a DNF classified at a podium position (attrition)', () => {
    // §2.4 guard: with RET rows now reaching the processor, a heavily attritioned
    // race can classify a DNF at a points- or podium-scoring slot. The dnf flag
    // — not the position — must drive credit: 0 points, no win, no podium, no
    // fastest-lap bonus, and a DNF-direction mood (never podium/race-win).
    const world = initializeGame('mclaren', 'golden-era', 1)
    const norrisId = 'norris'
    const piastriId = 'piastri'
    const otherIds = world.drivers
      .filter(d => d.teamId && !d.isReserve && !d.isF2 && d.id !== norrisId && d.id !== piastriId)
      .map(d => d.id)

    // piastri retired but is classified P2 (podium slot) under attrition, and
    // is flagged as holding the fastest lap. None of it may credit.
    const results: RaceResult[] = [
      { driverId: norrisId, position: 1, dnf: false, fastestLap: false },
      { driverId: piastriId, position: 2, dnf: true, fastestLap: true },
      ...otherIds.map((id, i) => ({ driverId: id, position: i + 3, dnf: false, fastestLap: false })),
    ]

    const moodBefore = world.drivers.find(d => d.id === piastriId)!.mood

    const update = processPostRace(
      world.teams, world.drivers, world.finance,
      [], {}, results, null, false, 1,
      world.gameState.season,
      'mclaren',
      createPRNG(7),
    )

    const pia = update.drivers.find(d => d.id === piastriId)!
    // No phantom credit from the P2 classification.
    expect(pia.seasonStats.points).toBe(0)
    expect(pia.seasonStats.wins).toBe(0)
    expect(pia.seasonStats.podiums).toBe(0)
    // DNF accounting still applies.
    expect(pia.seasonStats.dnfs).toBe(1)
    expect(pia.form).toEqual([21]) // FORM_DNF sentinel
    expect(pia.lastRaceResult).toBeNull()
    // Mood moved in the DNF direction (frustration up, confidence down), NOT
    // the podium direction (which would lower frustration and raise confidence).
    expect(pia.mood.frustration).toBeGreaterThan(moodBefore.frustration)
    expect(pia.mood.confidence).toBeLessThan(moodBefore.confidence)
  })

  it('caps driver.form at the rolling window size across many rounds', async () => {
    const { FORM_WINDOW } = await import('@/engine/drivers/form-history')
    const world = initializeGame('mclaren', 'golden-era', 1)
    let teams = world.teams
    let drivers = world.drivers
    let finance = world.finance

    const dummyResult = (id: string, pos: number): RaceResult => ({
      driverId: id, position: pos, dnf: false, fastestLap: false,
    })

    const activeIds = drivers
      .filter(d => d.teamId && !d.isReserve && !d.isF2)
      .map(d => d.id)

    for (let round = 1; round <= FORM_WINDOW + 3; round++) {
      const results: RaceResult[] = activeIds.map((id, i) => dummyResult(id, i + 1))
      const out = processPostRace(
        teams, drivers, finance, [], {}, results, null, false, round,
        world.gameState.season,
        'mclaren', createPRNG(round),
      )
      teams = out.teams
      drivers = out.drivers
      finance = out.finance
    }

    const nor = drivers.find(d => d.id === 'norris')!
    expect(nor.form.length).toBe(FORM_WINDOW)
    const mclaren = teams.find(t => t.id === 'mclaren')!
    expect(mclaren.seasonForm.length).toBe(FORM_WINDOW)
  })
})

describe('processPostRace — Factory OVR history', () => {
  it('appends the current OVR to ovrHistory for every team', async () => {
    const { calculateOverallRating } = await import('@/engine/engineering/car-performance')
    const world = initializeGame('mclaren', 'golden-era', 1)
    const results: RaceResult[] = world.drivers
      .filter(d => d.teamId && !d.isReserve && !d.isF2)
      .map((d, i) => ({ driverId: d.id, position: i + 1, dnf: false, fastestLap: false }))

    const update = processPostRace(
      world.teams, world.drivers, world.finance,
      [], {}, results, null, false, 1,
      world.gameState.season,
      'mclaren',
      createPRNG(3),
    )

    for (const team of update.teams) {
      const preTeam = world.teams.find(t => t.id === team.id)!
      expect(team.ovrHistory).toEqual([calculateOverallRating(preTeam.car)])
    }
  })

  it('does not duplicate entries when the same round is processed twice', () => {
    const world = initializeGame('mclaren', 'golden-era', 1)
    const results: RaceResult[] = world.drivers
      .filter(d => d.teamId && !d.isReserve && !d.isF2)
      .map((d, i) => ({ driverId: d.id, position: i + 1, dnf: false, fastestLap: false }))

    const first = processPostRace(
      world.teams, world.drivers, world.finance,
      [], {}, results, null, false, 1, world.gameState.season, 'mclaren', createPRNG(3),
    )
    const second = processPostRace(
      first.teams, first.drivers, first.finance,
      first.narrativeEvents, first.eventCooldowns, results, null, false, 1, world.gameState.season, 'mclaren', createPRNG(3),
    )

    const firstTeam = first.teams.find(t => t.id === 'mclaren')!
    const secondTeam = second.teams.find(t => t.id === 'mclaren')!
    expect(secondTeam.ovrHistory).toEqual(firstTeam.ovrHistory)
  })

  it('caps ovrHistory at OVR_HISTORY_WINDOW entries', async () => {
    const { OVR_HISTORY_WINDOW } = await import('@/engine/drivers/form-history')
    const world2 = initializeGame('mclaren', 'golden-era', 1)
    let { teams, drivers, finance } = world2

    const activeIds = drivers
      .filter(d => d.teamId && !d.isReserve && !d.isF2)
      .map(d => d.id)
    const baseResults: RaceResult[] = activeIds.map((id, i) => ({
      driverId: id, position: i + 1, dnf: false, fastestLap: false,
    }))

    for (let round = 1; round <= OVR_HISTORY_WINDOW + 3; round++) {
      const out = processPostRace(
        teams, drivers, finance,
        [], {}, baseResults, null, false, round, world2.gameState.season, 'mclaren', createPRNG(round),
      )
      teams = out.teams
      drivers = out.drivers
      finance = out.finance
    }

    const mclaren = teams.find(t => t.id === 'mclaren')!
    expect(mclaren.ovrHistory.length).toBe(OVR_HISTORY_WINDOW)
  })
})
