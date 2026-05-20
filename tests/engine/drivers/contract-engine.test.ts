import { describe, it, expect } from 'vitest'
import type { Driver } from '@/types/driver'
import { salariesSpent } from '@/engine/drivers/contract-engine'

function makeDriver(id: string, teamId: string | null, salary: number | null): Driver {
  return {
    id, firstName: 'First', lastName: 'Last', shortName: 'FLS', nationality: 'GB',
    age: 25, teamId, isReserve: false, isF2: false,
    attributes: { pace: 80, racecraft: 80, experience: 80, mentality: 80, marketability: 80, developmentPotential: 80 },
    mood: { motivation: 70, frustration: 20, confidence: 60 },
    contract: salary === null ? null
      : { salary, termEndSeason: 2, performanceBonuses: [], releaseClause: null },
    seasonStats: { points: 0, wins: 0, podiums: 0, poles: 0, dnfs: 0, penalties: 0, bestFinish: 0, averageFinish: 0, lastProcessedRound: 0 },
    rivalries: [], peakAge: 28, declineRate: 1, form: [], lastRaceResult: null,
    penaltyPoints: [], warningsThisSeason: 0, nextRaceGridDrop: 0, banUntilRound: null,
    careerWins: 0, careerPodiums: 0, careerStarts: 0, worldTitles: 0,
    pulse: { headline: '', detail: '' }, portraitUrl: null,
    scoutSignal: 'available', scoutingReports: 0,
  }
}

describe('salariesSpent', () => {
  it('sums salaries of the given team only', () => {
    const drivers = [
      makeDriver('a', 'mclaren', 30_000_000),
      makeDriver('b', 'mclaren', 15_000_000),
      makeDriver('c', 'ferrari', 55_000_000),
    ]
    expect(salariesSpent(drivers, 'mclaren')).toBe(45_000_000)
  })

  it('treats a null contract as zero salary', () => {
    const drivers = [makeDriver('a', 'mclaren', 30_000_000), makeDriver('b', 'mclaren', null)]
    expect(salariesSpent(drivers, 'mclaren')).toBe(30_000_000)
  })

  it('returns 0 when the team has no drivers', () => {
    expect(salariesSpent([makeDriver('c', 'ferrari', 55_000_000)], 'mclaren')).toBe(0)
  })
})
