import { describe, expect, it } from 'vitest'
import { applyScoutingReport } from '@/engine/drivers/apply-scouting-report'
import type { Driver } from '@/types/driver'

const baseDriver = (overrides: Partial<Driver> = {}): Driver => ({
  id: 'd1', firstName: 'A', lastName: 'B', shortName: 'AB',
  nationality: 'X', age: 20, teamId: null,
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

describe('applyScoutingReport', () => {
  it('increments scoutingReports by 1', () => {
    const r = applyScoutingReport(baseDriver({ scoutingReports: 3 }))
    expect(r.scoutingReports).toBe(4)
  })

  it('recomputes scoutSignal after increment (3 → 4 = available → tracking)', () => {
    const r = applyScoutingReport(baseDriver({ scoutingReports: 3, isF2: false, attributes: {
      pace: 70, racecraft: 60, experience: 60, mentality: 70, marketability: 55, developmentPotential: 50,
    } }))
    expect(r.scoutingReports).toBe(4)
    expect(r.scoutSignal).toBe('tracking')
  })

  it('recomputes scoutSignal after increment (7 → 8 = tracking → hot)', () => {
    const r = applyScoutingReport(baseDriver({ scoutingReports: 7 }))
    expect(r.scoutingReports).toBe(8)
    expect(r.scoutSignal).toBe('hot')
  })

  it('returns a new object (no mutation)', () => {
    const driver = baseDriver({ scoutingReports: 0 })
    const r = applyScoutingReport(driver)
    expect(r).not.toBe(driver)
    expect(driver.scoutingReports).toBe(0)
  })
})
