import { describe, expect, it } from 'vitest'
import {
  expectedSalary,
  acceptanceFloor,
  evaluateOffer,
  signFreeAgent,
} from '@/engine/drivers/free-agent-signing'
import type { Driver } from '@/types/driver'
import type { PrestigeRating } from '@/types/finance'
import type { FullGameState } from '@/engine/core/state-manager'
import type { OfferTerms } from '@/engine/drivers/free-agent-signing'
import { initializeGame } from '@/engine/core/state-manager'

const baseDriver = (overrides: Partial<Driver> = {}): Driver => ({
  id: 'd1', firstName: 'A', lastName: 'B', shortName: 'AB',
  nationality: 'X', age: 25, teamId: null,
  attributes: { pace: 80, racecraft: 75, experience: 60, mentality: 70, marketability: 60, developmentPotential: 70 },
  mood: { motivation: 80, frustration: 10, confidence: 70 },
  contract: null, rivalries: [],
  seasonStats: { points: 0, wins: 0, podiums: 0, poles: 0, dnfs: 0, penalties: 0, bestFinish: 99, averageFinish: 0, lastProcessedRound: 0 },
  peakAge: 28, declineRate: 0.4, isReserve: false, isF2: false,
  form: [], lastRaceResult: null,
  penaltyPoints: [], warningsThisSeason: 0, nextRaceGridDrop: 0, banUntilRound: null,
  careerWins: 0, careerPodiums: 0, careerStarts: 0, worldTitles: 0,
  pulse: { headline: '', detail: '' }, portraitUrl: null,
  scoutSignal: 'available', scoutingReports: 0,
  ...overrides,
})

describe('expectedSalary', () => {
  it('returns a deterministic salary for a given attribute set', () => {
    const driver = baseDriver({ attributes: { pace: 95, racecraft: 90, experience: 85, mentality: 85, marketability: 85, developmentPotential: 50 } })
    const a = expectedSalary(driver)
    const b = expectedSalary(driver)
    expect(a).toBe(b)
    expect(a).toBeGreaterThan(0)
  })

  it('places a 95-pace star driver in the 20-24M range', () => {
    // pace:95×80k + rc:90×60k + devpot:50×40k + exp:85×30k + mkt:90×50k = 22.05M
    const driver = baseDriver({ attributes: { pace: 95, racecraft: 90, experience: 85, mentality: 85, marketability: 90, developmentPotential: 50 } })
    const salary = expectedSalary(driver)
    expect(salary).toBeGreaterThanOrEqual(20_000_000)
    expect(salary).toBeLessThanOrEqual(24_000_000)
  })

  it('places a mid-grid driver (pace 75) in the 16-20M range', () => {
    // pace:75×80k + rc:70×60k + devpot:70×40k + exp:60×30k + mkt:60×50k = 17.8M
    const driver = baseDriver({ attributes: { pace: 75, racecraft: 70, experience: 60, mentality: 65, marketability: 60, developmentPotential: 70 } })
    const salary = expectedSalary(driver)
    expect(salary).toBeGreaterThanOrEqual(16_000_000)
    expect(salary).toBeLessThanOrEqual(20_000_000)
  })

  it('star driver earns more than mid-grid driver (relative ordering)', () => {
    const star = baseDriver({ attributes: { pace: 95, racecraft: 90, experience: 85, mentality: 85, marketability: 90, developmentPotential: 50 } })
    const mid = baseDriver({ attributes: { pace: 75, racecraft: 70, experience: 60, mentality: 65, marketability: 60, developmentPotential: 70 } })
    expect(expectedSalary(star)).toBeGreaterThan(expectedSalary(mid))
  })

  it('rounds to the nearest $1,000', () => {
    const driver = baseDriver()
    const salary = expectedSalary(driver)
    expect(salary % 1000).toBe(0)
  })
})

describe('acceptanceFloor', () => {
  const driver = baseDriver({ attributes: { pace: 80, racecraft: 75, experience: 60, mentality: 70, marketability: 60, developmentPotential: 70 } })
  const baseFloor = expectedSalary(driver)

  it('A+ team gets 15% discount', () => {
    expect(acceptanceFloor(driver, 'A+')).toBe(Math.round(baseFloor * 0.85 / 1000) * 1000)
  })

  it('F team pays 15% premium', () => {
    expect(acceptanceFloor(driver, 'F')).toBe(Math.round(baseFloor * 1.15 / 1000) * 1000)
  })

  it('C team pays exactly expectedSalary', () => {
    expect(acceptanceFloor(driver, 'C')).toBe(baseFloor)
  })

  it('all 8 prestige tiers produce monotonic floors', () => {
    const tiers: PrestigeRating[] = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F']
    const floors = tiers.map(t => acceptanceFloor(driver, t))
    for (let i = 1; i < floors.length; i++) {
      expect(floors[i]).toBeGreaterThanOrEqual(floors[i - 1])
    }
  })

  it('rounds to the nearest $1,000', () => {
    expect(acceptanceFloor(driver, 'B') % 1000).toBe(0)
  })
})

describe('evaluateOffer', () => {
  const driver = baseDriver({ attributes: { pace: 80, racecraft: 75, experience: 60, mentality: 70, marketability: 60, developmentPotential: 70 } })

  it('accepts when offer equals the floor', () => {
    const floor = acceptanceFloor(driver, 'C')
    const result = evaluateOffer(driver, { salary: floor, termYears: 2 }, 'C')
    expect(result.accepted).toBe(true)
    expect(result.floor).toBe(floor)
    expect(result.reason).toBeUndefined()
  })

  it('accepts when offer is above the floor', () => {
    const floor = acceptanceFloor(driver, 'B')
    const result = evaluateOffer(driver, { salary: floor + 1_000_000, termYears: 1 }, 'B')
    expect(result.accepted).toBe(true)
  })

  it('rejects when offer is below the floor', () => {
    const floor = acceptanceFloor(driver, 'D')
    const result = evaluateOffer(driver, { salary: floor - 500_000, termYears: 3 }, 'D')
    expect(result.accepted).toBe(false)
    expect(result.reason).toBe('Holding out for better terms — your offer is below market')
    expect(result.floor).toBe(floor)
  })

  it('contract length does not affect acceptance (v1)', () => {
    const floor = acceptanceFloor(driver, 'C')
    const r1 = evaluateOffer(driver, { salary: floor, termYears: 1 }, 'C')
    const r2 = evaluateOffer(driver, { salary: floor, termYears: 3 }, 'C')
    expect(r1.accepted).toBe(r2.accepted)
  })
})

const buildWorld = (): FullGameState => initializeGame('mclaren', 'golden-era', 42)

describe('signFreeAgent', () => {
  it('signs a free agent into an empty RESERVE slot', () => {
    const world = buildWorld()
    const playerTeamId = world.gameState.playerTeamId
    // Pick a free agent from the seed
    const freeAgent = world.drivers.find(d => d.teamId === null && !d.isF2)!
    expect(freeAgent).toBeDefined()
    // Confirm the player team currently has no reserve (or remove the existing reserve to set up the test)
    const reserveBefore = world.drivers.find(d => d.teamId === playerTeamId && d.isReserve)
    if (reserveBefore) {
      // Force the test scenario: clear the reserve slot first
      world.drivers = world.drivers.map(d => d.id === reserveBefore.id ? { ...d, teamId: null, contract: null } : d)
    }

    const offer: OfferTerms = { salary: 10_000_000, termYears: 2 }
    const result = signFreeAgent(world, playerTeamId, {
      driverId: freeAgent.id,
      offer,
      slotChoice: 'RESERVE',
      displaceDriverId: null,
    })

    const signed = result.world.drivers.find(d => d.id === freeAgent.id)!
    expect(signed.teamId).toBe(playerTeamId)
    expect(signed.contract).toEqual({
      salary: 10_000_000,
      termEndSeason: 2,
      performanceBonuses: [],
      releaseClause: null,
    })
    expect(result.signedDriver.id).toBe(freeAgent.id)
    expect(result.displacedDriver).toBeNull()
  })

  it('displaces an existing driver when the chosen slot is full', () => {
    const world = buildWorld()
    const playerTeamId = world.gameState.playerTeamId
    const freeAgent = world.drivers.find(d => d.teamId === null && !d.isF2)!
    const car01 = world.drivers.find(d => d.teamId === playerTeamId && !d.isReserve)!

    const result = signFreeAgent(world, playerTeamId, {
      driverId: freeAgent.id,
      offer: { salary: 12_000_000, termYears: 1 },
      slotChoice: 'CAR-01',
      displaceDriverId: car01.id,
    })

    const signed = result.world.drivers.find(d => d.id === freeAgent.id)!
    const displaced = result.world.drivers.find(d => d.id === car01.id)!

    expect(signed.teamId).toBe(playerTeamId)
    expect(signed.contract?.salary).toBe(12_000_000)
    expect(displaced.teamId).toBeNull()
    expect(displaced.contract).toBeNull()
    expect(result.displacedDriver?.id).toBe(car01.id)
    // Stats preserved verbatim
    expect(displaced.seasonStats).toEqual(car01.seasonStats)
    expect(displaced.attributes).toEqual(car01.attributes)
    expect(displaced.careerWins).toBe(car01.careerWins)
  })

  it('does not mutate the input world (purity)', () => {
    const world = buildWorld()
    const playerTeamId = world.gameState.playerTeamId
    const freeAgent = world.drivers.find(d => d.teamId === null)!
    const reserve = world.drivers.find(d => d.teamId === playerTeamId && d.isReserve)
    const snapshot = JSON.stringify(world)

    signFreeAgent(world, playerTeamId, {
      driverId: freeAgent.id,
      offer: { salary: 8_000_000, termYears: 2 },
      slotChoice: 'RESERVE',
      displaceDriverId: reserve?.id ?? null,
    })

    expect(JSON.stringify(world)).toBe(snapshot)
  })

  it('is deterministic — same input produces deep-equal output', () => {
    const world1 = buildWorld()
    const world2 = buildWorld()
    const playerTeamId = world1.gameState.playerTeamId
    const freeAgent = world1.drivers.find(d => d.teamId === null)!
    const reserve = world1.drivers.find(d => d.teamId === playerTeamId && d.isReserve)
    const params = {
      driverId: freeAgent.id,
      offer: { salary: 9_000_000, termYears: 2 } as OfferTerms,
      slotChoice: 'RESERVE' as const,
      displaceDriverId: reserve?.id ?? null,
    }

    const r1 = signFreeAgent(world1, playerTeamId, params)
    const r2 = signFreeAgent(world2, playerTeamId, params)

    expect(r1.world.drivers).toEqual(r2.world.drivers)
  })

  it('throws when called with a contracted driver (invariant violation)', () => {
    const world = buildWorld()
    const playerTeamId = world.gameState.playerTeamId
    const contracted = world.drivers.find(d => d.teamId !== null)!

    expect(() => signFreeAgent(world, playerTeamId, {
      driverId: contracted.id,
      offer: { salary: 10_000_000, termYears: 1 },
      slotChoice: 'RESERVE',
      displaceDriverId: null,
    })).toThrow(/free agent/i)
  })

  it('throws when displaceDriverId is null but the slot is occupied', () => {
    const world = buildWorld()
    const playerTeamId = world.gameState.playerTeamId
    const freeAgent = world.drivers.find(d => d.teamId === null)!

    expect(() => signFreeAgent(world, playerTeamId, {
      driverId: freeAgent.id,
      offer: { salary: 10_000_000, termYears: 1 },
      slotChoice: 'CAR-01',
      displaceDriverId: null,
    })).toThrow(/slot.*occupied|displace/i)
  })
})
