import { describe, expect, it } from 'vitest'
import {
  applyRaceCareerDeltas,
  applySeasonEndCareerDeltas,
} from '@/engine/drivers/career-stats'
import type { Driver } from '@/types/driver'

const baseDriver = (overrides: Partial<Driver> = {}): Driver => ({
  id: 'd1', firstName: 'A', lastName: 'B', shortName: 'AB',
  nationality: 'X', age: 25, teamId: 't1',
  attributes: { pace: 80, racecraft: 80, experience: 60, mentality: 70, marketability: 60, developmentPotential: 70 },
  mood: { motivation: 80, frustration: 10, confidence: 80 },
  contract: null, rivalries: [],
  seasonStats: { points: 0, wins: 0, podiums: 0, poles: 0, dnfs: 0, penalties: 0, bestFinish: 99, averageFinish: 0, lastProcessedRound: 0 },
  peakAge: 28, declineRate: 0.4, isReserve: false, isF2: false,
  form: [], lastRaceResult: null,
  penaltyPoints: [], warningsThisSeason: 0, nextRaceGridDrop: 0, banUntilRound: null,
  careerWins: 10, careerPodiums: 25, careerStarts: 100, worldTitles: 1,
  pulse: { headline: '', detail: '' }, portraitUrl: null,
  scoutSignal: 'available', scoutingReports: 0,
  ...overrides,
})

describe('applyRaceCareerDeltas', () => {
  it('increments careerStarts on every result (P1)', () => {
    const result = applyRaceCareerDeltas(baseDriver(), 1, false)
    expect(result.careerStarts).toBe(101)
  })

  it('increments careerStarts on a DNF (explicit dnf=true)', () => {
    const result = applyRaceCareerDeltas(baseDriver(), 21, true)
    expect(result.careerStarts).toBe(101)
    expect(result.careerWins).toBe(10)
    expect(result.careerPodiums).toBe(25)
  })

  it('increments careerWins and careerPodiums on P1', () => {
    const result = applyRaceCareerDeltas(baseDriver(), 1, false)
    expect(result.careerWins).toBe(11)
    expect(result.careerPodiums).toBe(26)
  })

  it('increments careerPodiums but not careerWins on P3', () => {
    const result = applyRaceCareerDeltas(baseDriver(), 3, false)
    expect(result.careerWins).toBe(10)
    expect(result.careerPodiums).toBe(26)
  })

  it('increments only careerStarts on P10', () => {
    const result = applyRaceCareerDeltas(baseDriver(), 10, false)
    expect(result.careerStarts).toBe(101)
    expect(result.careerWins).toBe(10)
    expect(result.careerPodiums).toBe(25)
  })

  it('does not credit win/podium when dnf=true even at P1 position value', () => {
    const result = applyRaceCareerDeltas(baseDriver(), 1, true)
    expect(result.careerStarts).toBe(101)
    expect(result.careerWins).toBe(10)
    expect(result.careerPodiums).toBe(25)
  })

  it('returns a new object (no mutation)', () => {
    const driver = baseDriver()
    const result = applyRaceCareerDeltas(driver, 1, false)
    expect(result).not.toBe(driver)
    expect(driver.careerWins).toBe(10) // unchanged
  })
})

describe('applySeasonEndCareerDeltas', () => {
  it('increments worldTitles when finalStanding is 1', () => {
    const result = applySeasonEndCareerDeltas(baseDriver(), 1)
    expect(result.worldTitles).toBe(2)
  })

  it('does not increment worldTitles when finalStanding is 2 or worse', () => {
    expect(applySeasonEndCareerDeltas(baseDriver(), 2).worldTitles).toBe(1)
    expect(applySeasonEndCareerDeltas(baseDriver(), 22).worldTitles).toBe(1)
  })

  it('returns a new object (no mutation)', () => {
    const driver = baseDriver()
    const result = applySeasonEndCareerDeltas(driver, 1)
    expect(result).not.toBe(driver)
    expect(driver.worldTitles).toBe(1)
  })
})
