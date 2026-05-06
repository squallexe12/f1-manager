import { describe, expect, it } from 'vitest'
import { computeChampionshipSummary } from '@/engine/drivers/championship-summary'
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
  careerWins: 0, careerPodiums: 0, careerStarts: 0, worldTitles: 0,
  pulse: { headline: '', detail: '' }, portraitUrl: null,
  scoutSignal: 'available', scoutingReports: 0,
  ...overrides,
})

describe('computeChampionshipSummary', () => {
  it('assigns positions in descending points order', () => {
    const drivers = [
      baseDriver({ id: 'p2', seasonStats: { points: 80, wins: 0, podiums: 0, poles: 0, dnfs: 0, penalties: 0, bestFinish: 99, averageFinish: 0, lastProcessedRound: 0 } }),
      baseDriver({ id: 'p1', seasonStats: { points: 120, wins: 0, podiums: 0, poles: 0, dnfs: 0, penalties: 0, bestFinish: 99, averageFinish: 0, lastProcessedRound: 0 } }),
      baseDriver({ id: 'p3', seasonStats: { points: 40, wins: 0, podiums: 0, poles: 0, dnfs: 0, penalties: 0, bestFinish: 99, averageFinish: 0, lastProcessedRound: 0 } }),
    ]
    const result = computeChampionshipSummary(drivers)
    expect(result.positionById['p1']).toBe(1)
    expect(result.positionById['p2']).toBe(2)
    expect(result.positionById['p3']).toBe(3)
  })

  it('leader gap equals points clear of P2', () => {
    const drivers = [
      baseDriver({ id: 'leader', seasonStats: { points: 120, wins: 0, podiums: 0, poles: 0, dnfs: 0, penalties: 0, bestFinish: 99, averageFinish: 0, lastProcessedRound: 0 } }),
      baseDriver({ id: 'second', seasonStats: { points: 80, wins: 0, podiums: 0, poles: 0, dnfs: 0, penalties: 0, bestFinish: 99, averageFinish: 0, lastProcessedRound: 0 } }),
      baseDriver({ id: 'third', seasonStats: { points: 40, wins: 0, podiums: 0, poles: 0, dnfs: 0, penalties: 0, bestFinish: 99, averageFinish: 0, lastProcessedRound: 0 } }),
    ]
    const result = computeChampionshipSummary(drivers)
    // Leader: 120 - 80 = 40
    expect(result.gapById['leader']).toBe(40)
  })

  it('behind-leader gaps are negative', () => {
    const drivers = [
      baseDriver({ id: 'leader', seasonStats: { points: 120, wins: 0, podiums: 0, poles: 0, dnfs: 0, penalties: 0, bestFinish: 99, averageFinish: 0, lastProcessedRound: 0 } }),
      baseDriver({ id: 'second', seasonStats: { points: 80, wins: 0, podiums: 0, poles: 0, dnfs: 0, penalties: 0, bestFinish: 99, averageFinish: 0, lastProcessedRound: 0 } }),
      baseDriver({ id: 'third', seasonStats: { points: 40, wins: 0, podiums: 0, poles: 0, dnfs: 0, penalties: 0, bestFinish: 99, averageFinish: 0, lastProcessedRound: 0 } }),
    ]
    const result = computeChampionshipSummary(drivers)
    // P2: 80 - 120 = -40
    expect(result.gapById['second']).toBe(-40)
    // P3: 40 - 120 = -80
    expect(result.gapById['third']).toBe(-80)
  })

  it('excludes reserves and free agents from championship table', () => {
    const drivers = [
      baseDriver({ id: 'active', teamId: 't1', seasonStats: { points: 50, wins: 0, podiums: 0, poles: 0, dnfs: 0, penalties: 0, bestFinish: 99, averageFinish: 0, lastProcessedRound: 0 } }),
      baseDriver({ id: 'reserve', teamId: 't1', isReserve: true, seasonStats: { points: 200, wins: 0, podiums: 0, poles: 0, dnfs: 0, penalties: 0, bestFinish: 99, averageFinish: 0, lastProcessedRound: 0 } }),
      baseDriver({ id: 'freeagent', teamId: null, seasonStats: { points: 300, wins: 0, podiums: 0, poles: 0, dnfs: 0, penalties: 0, bestFinish: 99, averageFinish: 0, lastProcessedRound: 0 } }),
    ]
    const result = computeChampionshipSummary(drivers)
    expect(result.positionById['active']).toBe(1)
    expect(result.positionById['reserve']).toBeUndefined()
    expect(result.positionById['freeagent']).toBeUndefined()
  })

  it('does not mutate the input array', () => {
    const drivers = [
      baseDriver({ id: 'a', seasonStats: { points: 100, wins: 0, podiums: 0, poles: 0, dnfs: 0, penalties: 0, bestFinish: 99, averageFinish: 0, lastProcessedRound: 0 } }),
      baseDriver({ id: 'b', seasonStats: { points: 50, wins: 0, podiums: 0, poles: 0, dnfs: 0, penalties: 0, bestFinish: 99, averageFinish: 0, lastProcessedRound: 0 } }),
    ]
    const originalOrder = [drivers[0].id, drivers[1].id]
    computeChampionshipSummary(drivers)
    expect(drivers.map(d => d.id)).toEqual(originalOrder)
  })
})
