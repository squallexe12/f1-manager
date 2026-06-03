import { describe, it, expect } from 'vitest'
import { evaluateSponsorKpi, type SponsorSeasonContext } from '@/engine/finance/sponsor-kpi'

const base: SponsorSeasonContext = {
  constructorPosition: 5,
  teamPoints: 0, teamWins: 0, teamPodiums: 0,
  driverMarketabilityAvg: 0, minDriverRaceFinishes: 0,
  bothDriversScored: 0, capBreached: false, teamDnfs: 0,
  currentRound: 11, totalRounds: 22,
}

describe('evaluateSponsorKpi', () => {
  it('teamPoints: 150/300 at mid-season is on pace (pace01≈1) but not met', () => {
    const r = evaluateSponsorKpi('teamPoints', 300, { ...base, teamPoints: 150 })
    expect(r.current).toBe(150)
    expect(r.met).toBe(false)
    expect(r.pace01).toBeCloseTo(1, 5)
  })

  it('teamPoints: met when current >= target', () => {
    const r = evaluateSponsorKpi('teamPoints', 300, { ...base, teamPoints: 320, currentRound: 22 })
    expect(r.met).toBe(true)
    expect(r.pace01).toBe(1)
  })

  it('teamPoints: behind pace lowers pace01', () => {
    const r = evaluateSponsorKpi('teamPoints', 300, { ...base, teamPoints: 30 }) // 0.1 raw / 0.5 frac = 0.2
    expect(r.pace01).toBeCloseTo(0.2, 5)
  })

  it('constructorPosition: met when position <= target', () => {
    const r = evaluateSponsorKpi('constructorPosition', 3, { ...base, constructorPosition: 2 })
    expect(r.current).toBe(2)
    expect(r.met).toBe(true)
    expect(r.pace01).toBe(1)
  })

  it('constructorPosition: closeness when not met', () => {
    const r = evaluateSponsorKpi('constructorPosition', 3, { ...base, constructorPosition: 5 })
    expect(r.met).toBe(false)
    // (12 - 5) / (12 - 3) = 7/9
    expect(r.pace01).toBeCloseTo(7 / 9, 5)
  })

  it('constructorPosition: unranked (0) treated as worst', () => {
    const r = evaluateSponsorKpi('constructorPosition', 3, { ...base, constructorPosition: 0 })
    expect(r.current).toBe(11)
    expect(r.met).toBe(false)
  })

  it('teamDnfs: met (lte) when at or below target', () => {
    const met = evaluateSponsorKpi('teamDnfs', 0, { ...base, teamDnfs: 0 })
    expect(met.met).toBe(true)
    expect(met.pace01).toBe(1)
    const broken = evaluateSponsorKpi('teamDnfs', 0, { ...base, teamDnfs: 2 })
    expect(broken.met).toBe(false)
    expect(broken.pace01).toBeLessThan(1)
  })

  it('noCapBreach: binary on breach flag', () => {
    expect(evaluateSponsorKpi('noCapBreach', 1, { ...base, capBreached: false }).met).toBe(true)
    expect(evaluateSponsorKpi('noCapBreach', 1, { ...base, capBreached: true }).met).toBe(false)
  })

  it('bothDriversScored: binary', () => {
    expect(evaluateSponsorKpi('bothDriversScored', 1, { ...base, bothDriversScored: 1 }).met).toBe(true)
    expect(evaluateSponsorKpi('bothDriversScored', 1, { ...base, bothDriversScored: 0 }).met).toBe(false)
  })

  it('driverMarketabilityAvg: met when avg >= target (not season-accumulating)', () => {
    const r = evaluateSponsorKpi('driverMarketabilityAvg', 70, { ...base, driverMarketabilityAvg: 72, currentRound: 1 })
    expect(r.met).toBe(true)
  })

  it('is deterministic — same input, same output', () => {
    const ctx = { ...base, teamPoints: 123 }
    expect(evaluateSponsorKpi('teamPoints', 300, ctx)).toEqual(evaluateSponsorKpi('teamPoints', 300, ctx))
  })
})

import { evaluateSponsorSeason } from '@/engine/finance/sponsor-kpi'
import type { Sponsor } from '@/types/finance'

function makeSponsor(): Sponsor {
  return {
    id: 'sp-test', name: 'Test', tier: 'title',
    annualValue: 1_000_000, bonusValue: 100_000,
    kpis: [
      { description: 'points', target: 300, current: 0, met: false },
      { description: 'wins', target: 3, current: 0, met: false },
    ],
    satisfaction: 60, contractEndSeason: 3, minimumPrestige: 'A',
    bonusPaidSeason: null,
  }
}

describe('evaluateSponsorSeason', () => {
  it('updates current/met per KPI and sets satisfaction to mean pace×100', () => {
    const ctx: SponsorSeasonContext = {
      ...base, teamPoints: 150, teamWins: 3, currentRound: 11, totalRounds: 22,
    }
    const updated = evaluateSponsorSeason(makeSponsor(), ['teamPoints', 'teamWins'], ctx)
    expect(updated.kpis[0].current).toBe(150)
    expect(updated.kpis[0].met).toBe(false) // 150 < 300
    expect(updated.kpis[1].current).toBe(3)
    expect(updated.kpis[1].met).toBe(true) // 3 >= 3
    // points pace01 = (150/300)/0.5 = 1 ; wins pace01 = met → 1 ; mean = 1 → 100
    expect(updated.satisfaction).toBe(100)
  })

  it('all KPIs met → every kpi.met true', () => {
    const ctx: SponsorSeasonContext = { ...base, teamPoints: 320, teamWins: 4, currentRound: 22, totalRounds: 22 }
    const updated = evaluateSponsorSeason(makeSponsor(), ['teamPoints', 'teamWins'], ctx)
    expect(updated.kpis.every(k => k.met)).toBe(true)
  })

  it('leaves a KPI unchanged when no metric is supplied for its index', () => {
    const updated = evaluateSponsorSeason(makeSponsor(), ['teamPoints'], { ...base, teamPoints: 10 })
    expect(updated.kpis[1].current).toBe(0) // index 1 had no metric
  })
})
