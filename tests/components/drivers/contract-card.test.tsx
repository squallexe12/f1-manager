import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContractCard } from '@/components/drivers/contract-card'
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
    performanceBonuses: [
      { condition: 'Per win', value: 750000 },
      { condition: 'World Championship', value: 5000000 },
    ],
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

describe('<ContractCard>', () => {
  it('renders free-agent fallback when contract is null', () => {
    render(
      <ContractCard
        driver={mkDriver({ contract: null })}
        currentSeason={2026}
        onNegotiate={vi.fn()}
        onRelease={vi.fn()}
      />
    )
    expect(screen.getByText('FREE AGENT — NO ACTIVE CONTRACT')).toBeInTheDocument()
  })

  it('shows EOS pill when termEndSeason <= 1', () => {
    render(
      <ContractCard
        driver={mkDriver({ contract: { salary: 1000000, termEndSeason: 1, performanceBonuses: [], releaseClause: null } })}
        currentSeason={2026}
        onNegotiate={vi.fn()}
        onRelease={vi.fn()}
      />
    )
    expect(screen.getByText('EOS')).toBeInTheDocument()
  })

  it('shows season number when termEndSeason > 1', () => {
    render(
      <ContractCard
        driver={mkDriver({ contract: { salary: 55000000, termEndSeason: 3, performanceBonuses: [], releaseClause: null } })}
        currentSeason={2026}
        onNegotiate={vi.fn()}
        onRelease={vi.fn()}
      />
    )
    // S2026 + 3 - 1 = S2028
    expect(screen.getAllByText('S2028').length).toBeGreaterThan(0)
  })

  it('renders performance bonuses when present', () => {
    render(
      <ContractCard
        driver={mkDriver()}
        currentSeason={2026}
        onNegotiate={vi.fn()}
        onRelease={vi.fn()}
      />
    )
    expect(screen.getByText('Per win')).toBeInTheDocument()
    expect(screen.getByText('World Championship')).toBeInTheDocument()
  })

  it('renders None for release clause when null', () => {
    render(
      <ContractCard
        driver={mkDriver({ contract: { salary: 55000000, termEndSeason: 3, performanceBonuses: [], releaseClause: null } })}
        currentSeason={2026}
        onNegotiate={vi.fn()}
        onRelease={vi.fn()}
      />
    )
    expect(screen.getByText('None')).toBeInTheDocument()
  })

  it('renders release clause value when present', () => {
    render(
      <ContractCard
        driver={mkDriver({ contract: { salary: 55000000, termEndSeason: 3, performanceBonuses: [], releaseClause: 10000000 } })}
        currentSeason={2026}
        onNegotiate={vi.fn()}
        onRelease={vi.fn()}
      />
    )
    expect(screen.getByText('$10M')).toBeInTheDocument()
  })

  it('calls onNegotiate when Open Negotiation is clicked', () => {
    const onNegotiate = vi.fn()
    render(
      <ContractCard
        driver={mkDriver()}
        currentSeason={2026}
        onNegotiate={onNegotiate}
        onRelease={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('Open Negotiation'))
    expect(onNegotiate).toHaveBeenCalledTimes(1)
  })

  it('calls onRelease when Release Talks is clicked', () => {
    const onRelease = vi.fn()
    render(
      <ContractCard
        driver={mkDriver()}
        currentSeason={2026}
        onNegotiate={vi.fn()}
        onRelease={onRelease}
      />
    )
    fireEvent.click(screen.getByText('Release Talks'))
    expect(onRelease).toHaveBeenCalledTimes(1)
  })
})
