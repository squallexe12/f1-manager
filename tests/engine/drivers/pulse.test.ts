import { describe, expect, it } from 'vitest'
import { derivePulse, type PulseContext } from '@/engine/drivers/pulse'
import type { Driver } from '@/types/driver'

const baseDriver = (overrides: Partial<Driver> = {}): Driver => ({
  id: 'd1', firstName: 'A', lastName: 'B', shortName: 'AB',
  nationality: 'X', age: 25, teamId: 't1',
  attributes: { pace: 80, racecraft: 80, experience: 60, mentality: 70, marketability: 60, developmentPotential: 70 },
  mood: { motivation: 80, frustration: 20, confidence: 80 },
  contract: null, rivalries: [],
  seasonStats: { points: 50, wins: 1, podiums: 3, poles: 0, dnfs: 1, penalties: 0, bestFinish: 1, averageFinish: 6.0, lastProcessedRound: 8 },
  peakAge: 28, declineRate: 0.4, isReserve: false, isF2: false,
  form: [3, 5, 1, 8], lastRaceResult: 8,
  penaltyPoints: [], warningsThisSeason: 0, nextRaceGridDrop: 0, banUntilRound: null,
  careerWins: 0, careerPodiums: 0, careerStarts: 100, worldTitles: 0,
  pulse: { headline: '', detail: '' }, portraitUrl: null,
  scoutSignal: 'available', scoutingReports: 0,
  ...overrides,
})

const baseCtx = (overrides: Partial<PulseContext> = {}): PulseContext => ({
  championshipPositionByDriverId: { d1: 5 },
  championshipGapByDriverId: { d1: -50 },
  totalDriversInChampionship: 22,
  currentRound: 8,
  currentSeason: 1,
  ...overrides,
})

describe('derivePulse — branch order', () => {
  it('branch 1: reserve driver', () => {
    const r = derivePulse(baseDriver({ isReserve: true }), baseCtx())
    expect(r.headline).toBe('Reserve · race-ready')
    expect(r.detail).toBe('Simulator pace tracking · awaiting call-up window')
  })

  it('branch 2: free agent F2', () => {
    const r = derivePulse(
      baseDriver({ teamId: null, isF2: true, age: 19, scoutingReports: 7 }),
      baseCtx(),
    )
    expect(r.headline).toBe('F2 prospect — on the radar')
    expect(r.detail).toBe('7 scouting reports filed · 19 years old')
  })

  it('branch 3: free agent veteran', () => {
    const r = derivePulse(
      baseDriver({ teamId: null, isF2: false, careerStarts: 130, careerWins: 4, careerPodiums: 12 }),
      baseCtx(),
    )
    expect(r.headline).toBe('Free agent · seeking seat')
    expect(r.detail).toBe('130 career starts · 4W / 12P')
  })

  it('branch 4: championship leader', () => {
    const r = derivePulse(
      baseDriver({ seasonStats: { points: 200, wins: 4, podiums: 6, poles: 3, dnfs: 1, penalties: 0, bestFinish: 1, averageFinish: 2.4, lastProcessedRound: 8 } }),
      baseCtx({ championshipPositionByDriverId: { d1: 1 }, championshipGapByDriverId: { d1: 30 } }),
    )
    expect(r.headline).toBe('Leading the championship')
    expect(r.detail).toBe('4W in 8 · +30 on P2 · 1 DNF')
  })

  it('branch 5: P2 within 25 pts', () => {
    const r = derivePulse(
      baseDriver({ seasonStats: { points: 168, wins: 4, podiums: 6, poles: 3, dnfs: 1, penalties: 0, bestFinish: 1, averageFinish: 2.4, lastProcessedRound: 8 } }),
      baseCtx({ championshipPositionByDriverId: { d1: 2 }, championshipGapByDriverId: { d1: -14 } }),
    )
    expect(r.headline).toBe('On championship pace')
    expect(r.detail).toBe('4W in 8 · trailing leader by 14 pts · 1 DNF')
  })

  it('branch 6: hot streak (3+ podiums in last 4)', () => {
    const r = derivePulse(
      baseDriver({ form: [2, 1, 3, 4], seasonStats: { points: 80, wins: 1, podiums: 3, poles: 0, dnfs: 0, penalties: 0, bestFinish: 1, averageFinish: 2.5, lastProcessedRound: 4 } }),
      baseCtx({ championshipPositionByDriverId: { d1: 4 }, championshipGapByDriverId: { d1: -60 } }),
    )
    expect(r.headline).toBe('On a hot streak')
    expect(r.detail).toBe('3 podiums in last 4 · best P1')
  })

  it('branch 7: DNF in last 2 races', () => {
    const r = derivePulse(
      baseDriver({ form: [3, 5, 21, 21], seasonStats: { points: 30, wins: 0, podiums: 1, poles: 0, dnfs: 2, penalties: 0, bestFinish: 3, averageFinish: 8, lastProcessedRound: 4 } }),
      baseCtx({ championshipPositionByDriverId: { d1: 8 } }),
    )
    expect(r.headline).toBe('Reliability under fire')
    expect(r.detail).toBe('2 DNFs this season · last race DNF')
  })

  it('branch 8: stewards circling (>= 9 active points)', () => {
    const r = derivePulse(
      baseDriver({
        penaltyPoints: [
          { points: 4, issuedSeason: 1, issuedRound: 5, offenceType: 'collision-serious' as const, raceId: 'r5' },
          { points: 3, issuedSeason: 1, issuedRound: 6, offenceType: 'pit-lane-speeding' as const, raceId: 'r6' },
          { points: 3, issuedSeason: 1, issuedRound: 7, offenceType: 'forcing-off' as const, raceId: 'r7' },
        ],
        warningsThisSeason: 2,
      }),
      baseCtx(),
    )
    expect(r.headline).toBe('Stewards circling')
    expect(r.detail).toBe('10 active penalty points · 2 warnings')
  })

  it('branch 9: rookie campaign', () => {
    const r = derivePulse(
      baseDriver({
        attributes: { pace: 78, racecraft: 70, experience: 30, mentality: 65, marketability: 60, developmentPotential: 90 },
        age: 21,
        seasonStats: { points: 14, wins: 0, podiums: 0, poles: 0, dnfs: 1, penalties: 3, bestFinish: 7, averageFinish: 12, lastProcessedRound: 6 },
      }),
      baseCtx({ championshipPositionByDriverId: { d1: 14 } }),
    )
    expect(r.headline).toBe('Rookie campaign — finding rhythm')
    expect(r.detail).toBe('P7 best · 3 penalties · qualifying ahead of race-day')
  })

  it('branch 10: pressure building (frustration >= 70)', () => {
    const r = derivePulse(
      baseDriver({
        mood: { motivation: 60, frustration: 75, confidence: 50 },
        lastRaceResult: 12,
      }),
      baseCtx({ championshipPositionByDriverId: { d1: 9 } }),
    )
    expect(r.headline).toBe('Pressure building')
    expect(r.detail).toBe('P9 · last race P12 · mood deteriorating')
  })

  it('branch 11: locked in', () => {
    const r = derivePulse(
      baseDriver({
        mood: { motivation: 90, frustration: 10, confidence: 88 },
        seasonStats: { points: 60, wins: 1, podiums: 2, poles: 0, dnfs: 0, penalties: 0, bestFinish: 1, averageFinish: 5, lastProcessedRound: 6 },
      }),
      baseCtx({ championshipPositionByDriverId: { d1: 6 } }),
    )
    expect(r.headline).toBe('Locked in')
    expect(r.detail).toBe('P6 · 60 pts · 1W in 6')
  })

  it('branch 12: midfield grind (P11+)', () => {
    const r = derivePulse(
      baseDriver({ seasonStats: { points: 4, wins: 0, podiums: 0, poles: 0, dnfs: 0, penalties: 0, bestFinish: 9, averageFinish: 13, lastProcessedRound: 6 } }),
      baseCtx({ championshipPositionByDriverId: { d1: 13 } }),
    )
    expect(r.headline).toBe('Midfield grind')
    expect(r.detail).toBe('P13 · 4 pts · best P9')
  })

  it('branch 13: fallback (P5 default driver)', () => {
    const r = derivePulse(baseDriver(), baseCtx({ championshipPositionByDriverId: { d1: 5 } }))
    expect(r.headline).toBe('Chasing form')
    expect(r.detail).toBe('P5 · 50 pts · 8 rounds in')
  })
})

describe('derivePulse — determinism', () => {
  it('same input produces byte-identical output', () => {
    const driver = baseDriver()
    const ctx = baseCtx()
    const a = derivePulse(driver, ctx)
    const b = derivePulse(driver, ctx)
    expect(a).toEqual(b)
    expect(a).not.toBe(b) // new object each call
  })
})

describe('derivePulse — edge cases', () => {
  it('handles missing championship position (undefined → fallback)', () => {
    const r = derivePulse(baseDriver(), baseCtx({ championshipPositionByDriverId: {} }))
    expect(r.headline).toBeDefined()
    expect(r.detail).toBeDefined()
  })

  it('singularizes "1 DNF" but pluralizes "2 DNFs"', () => {
    const a = derivePulse(
      baseDriver({ form: [3, 5, 21, 21], seasonStats: { points: 30, wins: 0, podiums: 1, poles: 0, dnfs: 1, penalties: 0, bestFinish: 3, averageFinish: 8, lastProcessedRound: 4 } }),
      baseCtx({ championshipPositionByDriverId: { d1: 8 } }),
    )
    expect(a.detail).toContain('1 DNF this season')

    const b = derivePulse(
      baseDriver({ form: [3, 5, 21, 21], seasonStats: { points: 30, wins: 0, podiums: 1, poles: 0, dnfs: 2, penalties: 0, bestFinish: 3, averageFinish: 8, lastProcessedRound: 4 } }),
      baseCtx({ championshipPositionByDriverId: { d1: 8 } }),
    )
    expect(b.detail).toContain('2 DNFs this season')
  })
})
