import { describe, it, expect } from 'vitest'
import {
  boostSponsorSatisfaction,
  reduceDriverFrustration,
} from '@/engine/delegation/recommendation-helpers'
import type { FinanceState, Sponsor } from '@/types/finance'
import type { Driver } from '@/types/driver'

function makeSponsor(id: string, satisfaction: number): Sponsor {
  return {
    id,
    name: `Sponsor ${id}`,
    tier: 'minor',
    annualValue: 1_000_000,
    bonusValue: 0,
    kpis: [],
    satisfaction,
    contractEndSeason: 2,
    minimumPrestige: 'C',
  }
}

function makeFinance(sponsors: Sponsor[]): FinanceState {
  return {
    budget: {
      cap: 215_000_000,
      totalSpent: 0,
      categories: [],
      projectedEndOfSeason: 0,
      penaltyRisk: false,
    },
    sponsors,
    prestige: 'B',
    prestigeScore: 60,
    prizeMoneyEstimate: 0,
    marketingBudget: 0,
  }
}

function makeDriver(id: string, frustration: number): Driver {
  return {
    id,
    firstName: 'First',
    lastName: 'Last',
    shortName: 'FLS',
    nationality: 'GB',
    age: 25,
    teamId: 'mclaren',
    isReserve: false,
    isF2: false,
    attributes: {
      pace: 80, racecraft: 80, experience: 80, mentality: 80,
      marketability: 80, developmentPotential: 80,
    },
    mood: { motivation: 70, frustration, confidence: 60 },
    contract: null,
    seasonStats: {
      points: 0, wins: 0, podiums: 0, poles: 0, dnfs: 0,
      penalties: 0, bestFinish: 0, averageFinish: 0, lastProcessedRound: 0,
    },
    rivalries: [],
    peakAge: 28,
    declineRate: 1,
    form: [],
    lastRaceResult: null,
    penaltyPoints: [],
    warningsThisSeason: 0,
    nextRaceGridDrop: 0,
    banUntilRound: null,
    careerWins: 0,
    careerPodiums: 0,
    careerStarts: 0,
    worldTitles: 0,
    pulse: { headline: '', detail: '' },
    portraitUrl: null,
    scoutSignal: 'available' as const,
    scoutingReports: 0,
  }
}

describe('boostSponsorSatisfaction', () => {
  it('raises the lowest-satisfaction sponsor by 10', () => {
    const finance = makeFinance([
      makeSponsor('a', 70),
      makeSponsor('b', 30),
      makeSponsor('c', 50),
    ])
    const next = boostSponsorSatisfaction(finance)
    const updated = next.sponsors.find(s => s.id === 'b')!
    expect(updated.satisfaction).toBe(40)
    const untouched = next.sponsors.find(s => s.id === 'a')!
    expect(untouched.satisfaction).toBe(70)
  })

  it('clamps satisfaction at 100', () => {
    const finance = makeFinance([makeSponsor('a', 95)])
    const next = boostSponsorSatisfaction(finance)
    expect(next.sponsors[0].satisfaction).toBe(100)
  })

  it('returns the input unchanged if there are no sponsors', () => {
    const finance = makeFinance([])
    const next = boostSponsorSatisfaction(finance)
    expect(next).toBe(finance)
  })

  it('does not mutate the input', () => {
    const finance = makeFinance([makeSponsor('a', 40)])
    const before = JSON.stringify(finance)
    boostSponsorSatisfaction(finance)
    expect(JSON.stringify(finance)).toBe(before)
  })
})

describe('reduceDriverFrustration', () => {
  it('reduces target driver frustration by 20', () => {
    const drivers = [makeDriver('norris', 80), makeDriver('piastri', 40)]
    const next = reduceDriverFrustration(drivers, 'norris')
    expect(next.find(d => d.id === 'norris')!.mood.frustration).toBe(60)
    expect(next.find(d => d.id === 'piastri')!.mood.frustration).toBe(40)
  })

  it('clamps frustration at 0', () => {
    const drivers = [makeDriver('norris', 10)]
    const next = reduceDriverFrustration(drivers, 'norris')
    expect(next[0].mood.frustration).toBe(0)
  })

  it('returns the input unchanged when driver is not found', () => {
    const drivers = [makeDriver('norris', 80)]
    const next = reduceDriverFrustration(drivers, 'unknown')
    expect(next).toBe(drivers)
  })

  it('does not mutate the input', () => {
    const drivers = [makeDriver('norris', 80)]
    const before = JSON.stringify(drivers)
    reduceDriverFrustration(drivers, 'norris')
    expect(JSON.stringify(drivers)).toBe(before)
  })
})
