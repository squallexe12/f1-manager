import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DriverCard } from '@/components/paddock/driver-card'
import type { Driver } from '@/types/driver'

const mkDriver = (overrides: Partial<Driver> = {}): Driver => ({
  id: 'd1',
  firstName: 'Max',
  lastName: 'Verstappen',
  shortName: 'VER',
  nationality: 'NED',
  age: 28,
  teamId: 't1',
  attributes: { pace: 97, racecraft: 96, experience: 92, mentality: 90, marketability: 95, developmentPotential: 50 },
  mood: { motivation: 90, confidence: 88, frustration: 20 },
  contract: {
    salary: 55000000,
    termEndSeason: 3,
    performanceBonuses: [],
    releaseClause: null,
  },
  seasonStats: { points: 0, wins: 0, podiums: 0, poles: 0, dnfs: 0, penalties: 0, bestFinish: 0, averageFinish: 0, lastProcessedRound: 0 },
  rivalries: [],
  peakAge: 28,
  declineRate: 0.5,
  isReserve: false,
  isF2: false,
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
  scoutSignal: 'available',
  scoutingReports: 0,
  ...overrides,
})

const renderCard = (driver: Driver) =>
  render(<DriverCard driver={driver} driverNumber={1} wdcPosition={1} teamColor="#ff0000" />)

describe('<DriverCard> contract label', () => {
  it('shows "N SEASONS LEFT" for a multi-season contract, without the expiring class', () => {
    renderCard(mkDriver({ contract: { salary: 1, termEndSeason: 3, performanceBonuses: [], releaseClause: null } }))
    const token = screen.getByText('3 SEASONS LEFT')
    expect(token).toBeInTheDocument()
    expect(token.className).not.toContain('expiring')
  })

  it('shows "FINAL SEASON" with the expiring class when termEndSeason === 1', () => {
    renderCard(mkDriver({ contract: { salary: 1, termEndSeason: 1, performanceBonuses: [], releaseClause: null } }))
    const token = screen.getByText('FINAL SEASON')
    expect(token).toBeInTheDocument()
    expect(token.className).toContain('expiring')
  })

  it('shows "FREE AGENT" when there is no contract', () => {
    renderCard(mkDriver({ contract: null }))
    expect(screen.getByText('FREE AGENT')).toBeInTheDocument()
  })

  it('regression: never renders the year-sliced "CONTRACT THRU" string for a relative term', () => {
    renderCard(mkDriver({ contract: { salary: 1, termEndSeason: 3, performanceBonuses: [], releaseClause: null } }))
    expect(screen.queryByText(/CONTRACT THRU/)).toBeNull()
    expect(screen.queryByText(/'03/)).toBeNull()
  })
})
