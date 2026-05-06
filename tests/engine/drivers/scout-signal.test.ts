import { describe, expect, it } from 'vitest'
import { computeScoutSignal } from '@/engine/drivers/scout-signal'
import type { Driver } from '@/types/driver'

const baseDriver = (overrides: Partial<Driver> = {}): Driver => ({
  id: 'd1', firstName: 'A', lastName: 'B', shortName: 'AB',
  nationality: 'X', age: 22, teamId: null,
  attributes: { pace: 80, racecraft: 75, experience: 30, mentality: 70, marketability: 60, developmentPotential: 80 },
  mood: { motivation: 80, frustration: 10, confidence: 70 },
  contract: null, rivalries: [],
  seasonStats: { points: 0, wins: 0, podiums: 0, poles: 0, dnfs: 0, penalties: 0, bestFinish: 99, averageFinish: 0, lastProcessedRound: 0 },
  peakAge: 28, declineRate: 0.4, isReserve: false, isF2: true,
  form: [], lastRaceResult: null,
  penaltyPoints: [], warningsThisSeason: 0, nextRaceGridDrop: 0, banUntilRound: null,
  careerWins: 0, careerPodiums: 0, careerStarts: 0, worldTitles: 0,
  pulse: { headline: '', detail: '' }, portraitUrl: null,
  scoutSignal: 'available', scoutingReports: 0,
  ...overrides,
})

describe('computeScoutSignal', () => {
  it('hot when scoutingReports >= 8', () => {
    expect(computeScoutSignal(baseDriver({ scoutingReports: 8 }))).toBe('hot')
    expect(computeScoutSignal(baseDriver({ scoutingReports: 12 }))).toBe('hot')
  })

  it('hot when pace >= 85 AND devPotential >= 85', () => {
    expect(computeScoutSignal(baseDriver({
      attributes: { pace: 85, racecraft: 70, experience: 30, mentality: 70, marketability: 60, developmentPotential: 85 },
      scoutingReports: 0,
    }))).toBe('hot')
  })

  it('not hot when pace 85 but devPotential 84', () => {
    expect(computeScoutSignal(baseDriver({
      attributes: { pace: 85, racecraft: 70, experience: 30, mentality: 70, marketability: 60, developmentPotential: 84 },
      scoutingReports: 0,
    }))).toBe('tracking') // F2 + devPot 84 hits branch 4
  })

  it('tracking when scoutingReports >= 4 (and < 8)', () => {
    expect(computeScoutSignal(baseDriver({ scoutingReports: 4 }))).toBe('tracking')
    expect(computeScoutSignal(baseDriver({ scoutingReports: 7 }))).toBe('tracking')
  })

  it('tracking when isF2 AND devPotential >= 75', () => {
    expect(computeScoutSignal(baseDriver({ isF2: true, attributes: {
      pace: 70, racecraft: 60, experience: 20, mentality: 70, marketability: 50, developmentPotential: 75,
    } }))).toBe('tracking')
  })

  it('available otherwise', () => {
    expect(computeScoutSignal(baseDriver({
      isF2: false,
      attributes: { pace: 70, racecraft: 65, experience: 60, mentality: 70, marketability: 55, developmentPotential: 50 },
      scoutingReports: 0,
    }))).toBe('available')
  })

  it('exact threshold tests', () => {
    expect(computeScoutSignal(baseDriver({ scoutingReports: 7 }))).toBe('tracking')
    expect(computeScoutSignal(baseDriver({ scoutingReports: 8 }))).toBe('hot')
    expect(computeScoutSignal(baseDriver({ scoutingReports: 3, isF2: false }))).toBe('available')
    expect(computeScoutSignal(baseDriver({ scoutingReports: 4, isF2: false }))).toBe('tracking')
  })
})
