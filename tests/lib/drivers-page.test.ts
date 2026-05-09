import { describe, expect, it } from 'vitest'
import {
  computePeerAttributes,
  computeChampionshipSummary,
  buildRivalryIndex,
} from '@/lib/utils/drivers-page'
import type { Driver, DriverAttributes } from '@/types/driver'
import type { Team } from '@/types/team'

const baseDriver = (id: string, overrides: Partial<Driver> = {}): Driver => ({
  id, firstName: id.toUpperCase(), lastName: 'X', shortName: id.slice(0, 3).toUpperCase(),
  nationality: 'X', age: 25, teamId: 't1',
  attributes: { pace: 80, racecraft: 80, experience: 60, mentality: 70, marketability: 60, developmentPotential: 70 },
  mood: { motivation: 80, frustration: 20, confidence: 80 },
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

describe('computePeerAttributes', () => {
  it('returns mean of every attribute across active non-reserve drivers', () => {
    const drivers = [
      baseDriver('a', { attributes: { pace: 90, racecraft: 80, experience: 70, mentality: 60, marketability: 50, developmentPotential: 40 } }),
      baseDriver('b', { attributes: { pace: 80, racecraft: 70, experience: 60, mentality: 50, marketability: 40, developmentPotential: 30 } }),
    ]
    const peer = computePeerAttributes(drivers)
    expect(peer.pace).toBe(85)
    expect(peer.racecraft).toBe(75)
    expect(peer.experience).toBe(65)
    expect(peer.mentality).toBe(55)
    expect(peer.marketability).toBe(45)
    expect(peer.developmentPotential).toBe(35)
  })

  it('excludes reserves and free agents from the average', () => {
    const drivers = [
      baseDriver('a', { attributes: { pace: 90 } as DriverAttributes }),
      baseDriver('reserve', { isReserve: true, attributes: { pace: 30 } as DriverAttributes }),
      baseDriver('free', { teamId: null, attributes: { pace: 10 } as DriverAttributes }),
    ]
    const peer = computePeerAttributes(drivers)
    expect(peer.pace).toBe(90)
  })
})

describe('computeChampionshipSummary', () => {
  it('ranks drivers by points and computes gaps', () => {
    const drivers = [
      baseDriver('a', { seasonStats: { ...baseDriver('a').seasonStats, points: 100 } }),
      baseDriver('b', { seasonStats: { ...baseDriver('b').seasonStats, points: 75 } }),
      baseDriver('c', { seasonStats: { ...baseDriver('c').seasonStats, points: 50 } }),
    ]
    const s = computeChampionshipSummary(drivers)
    expect(s.positionById['a']).toBe(1)
    expect(s.positionById['b']).toBe(2)
    expect(s.positionById['c']).toBe(3)
    expect(s.gapById['a']).toBe(25)  // leader: gap to P2
    expect(s.gapById['b']).toBe(-25) // behind leader
    expect(s.gapById['c']).toBe(-50)
  })
})

describe('buildRivalryIndex', () => {
  it('resolves targetDriverId to display fields', () => {
    const teams: Team[] = [{ id: 't1', name: 'Team One', shortName: 'T1' } as any]
    const drivers = [
      baseDriver('me', { rivalries: [{ targetDriverId: 'rival1', intensity: 70, cause: 'Q3 contact' }] }),
      baseDriver('rival1', { firstName: 'L', lastName: 'Norris', shortName: 'NOR', teamId: 't1' }),
    ]
    const idx = buildRivalryIndex(drivers, teams)
    expect(idx['rival1'].code).toBe('NOR')
    expect(idx['rival1'].name).toBe('L. Norris')
    expect(idx['rival1'].teamName).toBe('Team One')
  })
})

