import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AttributesCard } from '@/components/drivers/attributes-card'
import type { Driver, DriverAttributes } from '@/types/driver'

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
  contract: { salary: 55000000, termEndSeason: 3, performanceBonuses: [], releaseClause: null },
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

const peer: DriverAttributes = {
  pace: 84,
  racecraft: 82,
  experience: 78,
  mentality: 74,
  marketability: 72,
  developmentPotential: 68,
}

describe('<AttributesCard>', () => {
  it('renders all 6 attribute labels', () => {
    render(<AttributesCard driver={mkDriver()} peer={peer} teamColor="oklch(0.62 0.20 265)" />)
    expect(screen.getByText('PACE')).toBeInTheDocument()
    expect(screen.getByText('RACECRAFT')).toBeInTheDocument()
    expect(screen.getByText('EXPERIENCE')).toBeInTheDocument()
    expect(screen.getByText('MENTALITY')).toBeInTheDocument()
    expect(screen.getByText('MARKETABILITY')).toBeInTheDocument()
    expect(screen.getByText('POTENTIAL')).toBeInTheDocument()
  })

  it('computes positive peer delta correctly (+13 for pace 97 vs peer 84)', () => {
    const { container } = render(<AttributesCard driver={mkDriver()} peer={peer} teamColor="oklch(0.62 0.20 265)" />)
    // pace = 97, peer.pace = 84, delta = +13
    const upDeltas = container.querySelectorAll('.delta.up')
    expect(upDeltas.length).toBeGreaterThan(0)
    const paceUp = Array.from(upDeltas).find(el => el.textContent === '+13')
    expect(paceUp).toBeTruthy()
  })

  it('computes negative peer delta correctly (-18 for developmentPotential 50 vs peer 68)', () => {
    const { container } = render(<AttributesCard driver={mkDriver()} peer={peer} teamColor="oklch(0.62 0.20 265)" />)
    // developmentPotential = 50, peer.developmentPotential = 68, delta = -18
    const downDeltas = container.querySelectorAll('.delta.dn')
    expect(downDeltas.length).toBeGreaterThan(0)
    const potDown = Array.from(downDeltas).find(el => el.textContent === '-18')
    expect(potDown).toBeTruthy()
  })

  it('renders radar and bars sections', () => {
    const { container } = render(<AttributesCard driver={mkDriver()} peer={peer} teamColor="oklch(0.62 0.20 265)" />)
    expect(container.querySelector('.attr-radar')).toBeTruthy()
    expect(container.querySelector('.attr-bars')).toBeTruthy()
  })
})
