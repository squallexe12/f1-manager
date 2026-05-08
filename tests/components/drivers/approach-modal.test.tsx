import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ApproachModal } from '@/components/drivers/approach-modal'
import type { Driver } from '@/types/driver'
import type { OfferTerms, OfferResult } from '@/engine/drivers/free-agent-signing'

const mkDriver = (overrides: Partial<Driver> = {}): Driver => ({
  id: 'd1', firstName: 'Aiko', lastName: 'Yoshida', shortName: 'YOS',
  nationality: 'Japanese', age: 19, teamId: null,
  attributes: { pace: 75, racecraft: 65, experience: 30, mentality: 70, marketability: 65, developmentPotential: 95 },
  mood: { motivation: 80, frustration: 10, confidence: 70 },
  contract: null, rivalries: [],
  seasonStats: { points: 0, wins: 0, podiums: 0, poles: 0, dnfs: 0, penalties: 0, bestFinish: 99, averageFinish: 0, lastProcessedRound: 0 },
  peakAge: 28, declineRate: 0.4, isReserve: false, isF2: true,
  form: [], lastRaceResult: null,
  penaltyPoints: [], warningsThisSeason: 0, nextRaceGridDrop: 0, banUntilRound: null,
  careerWins: 0, careerPodiums: 0, careerStarts: 0, worldTitles: 0,
  pulse: { headline: '', detail: '' }, portraitUrl: null,
  scoutSignal: 'tracking', scoutingReports: 0,
  ...overrides,
})

const mkAcceptOffer = () => vi.fn((offer: OfferTerms): OfferResult => ({
  accepted: offer.salary >= 7_000_000,
  floor: 7_000_000,
  reason: offer.salary < 7_000_000 ? 'Holding out for better terms — your offer is below market' : undefined,
}))

describe('<ApproachModal>', () => {
  it('renders driver name and the term toggle defaults to 2Y', () => {
    render(<ApproachModal
      driver={mkDriver()}
      remainingCap={150_000_000}
      rosterSlots={{ car01: null, car02: null, reserve: null }}
      currentPhase="management"
      evaluate={mkAcceptOffer()}
      onClose={vi.fn()}
      onSubmit={vi.fn()}
    />)
    // Driver name is split across text nodes (first + strong last), match each part
    expect(screen.getByText('Aiko', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('YOSHIDA')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2Y', pressed: true })).toBeInTheDocument()
  })

  it('shows accept banner when slider is above floor', () => {
    render(<ApproachModal
      driver={mkDriver()}
      remainingCap={150_000_000}
      rosterSlots={{ car01: null, car02: null, reserve: null }}
      currentPhase="management"
      evaluate={mkAcceptOffer()}
      onClose={vi.fn()}
      onSubmit={vi.fn()}
    />)
    // Default slider position should be at expectedSalary (above floor in this test fixture)
    expect(screen.getByText(/will accept/i)).toBeInTheDocument()
  })

  it('shows rejection banner when offer is below floor', () => {
    // Use a mock that always rejects (floor higher than slider max) to test rejection state
    const alwaysReject = vi.fn((): OfferResult => ({
      accepted: false,
      floor: 25_000_000,
      reason: 'Holding out for better terms — your offer is below market',
    }))
    render(<ApproachModal
      driver={mkDriver()}
      remainingCap={150_000_000}
      rosterSlots={{ car01: null, car02: null, reserve: null }}
      currentPhase="management"
      evaluate={alwaysReject}
      onClose={vi.fn()}
      onSubmit={vi.fn()}
    />)
    expect(screen.getByText(/below market/i)).toBeInTheDocument()
  })

  it('hides slot picker when only one slot is open (auto-fills)', () => {
    render(<ApproachModal
      driver={mkDriver()}
      remainingCap={150_000_000}
      rosterSlots={{ car01: mkDriver({ id: 'a' }), car02: mkDriver({ id: 'b' }), reserve: null }}
      currentPhase="management"
      evaluate={mkAcceptOffer()}
      onClose={vi.fn()}
      onSubmit={vi.fn()}
    />)
    expect(screen.getByText(/Filling: RESERVE/i)).toBeInTheDocument()
  })

  it('shows displacement picker when no slots are open', () => {
    render(<ApproachModal
      driver={mkDriver()}
      remainingCap={150_000_000}
      rosterSlots={{
        car01: mkDriver({ id: 'a', firstName: 'Alpha' }),
        car02: mkDriver({ id: 'b', firstName: 'Bravo' }),
        reserve: mkDriver({ id: 'c', firstName: 'Charlie' }),
      }}
      currentPhase="management"
      evaluate={mkAcceptOffer()}
      onClose={vi.fn()}
      onSubmit={vi.fn()}
    />)
    expect(screen.getByText(/Roster full/i)).toBeInTheDocument()
    expect(screen.getByText(/Alpha/)).toBeInTheDocument()
    expect(screen.getByText(/Bravo/)).toBeInTheDocument()
    expect(screen.getByText(/Charlie/)).toBeInTheDocument()
  })

  it('disables Submit when phase is not management', () => {
    render(<ApproachModal
      driver={mkDriver()}
      remainingCap={150_000_000}
      rosterSlots={{ car01: null, car02: null, reserve: null }}
      currentPhase="race"
      evaluate={mkAcceptOffer()}
      onClose={vi.fn()}
      onSubmit={vi.fn()}
    />)
    const submit = screen.getByRole('button', { name: /Submit Offer/i })
    expect(submit).toBeDisabled()
  })

  it('calls onSubmit with the right shape on Submit click (single open slot → auto-fills RESERVE)', () => {
    const onSubmit = vi.fn()
    // Only RESERVE is open — auto-fills with no picker shown
    render(<ApproachModal
      driver={mkDriver()}
      remainingCap={150_000_000}
      rosterSlots={{ car01: mkDriver({ id: 'a' }), car02: mkDriver({ id: 'b' }), reserve: null }}
      currentPhase="management"
      evaluate={mkAcceptOffer()}
      onClose={vi.fn()}
      onSubmit={onSubmit}
    />)
    fireEvent.click(screen.getByRole('button', { name: /Submit Offer/i }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ salary: expect.any(Number), termYears: 2 }),
      'RESERVE',
      null,
    )
  })

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn()
    render(<ApproachModal
      driver={mkDriver()}
      remainingCap={150_000_000}
      rosterSlots={{ car01: null, car02: null, reserve: null }}
      currentPhase="management"
      evaluate={mkAcceptOffer()}
      onClose={onClose}
      onSubmit={vi.fn()}
    />)
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('closes on Escape key', () => {
    const onClose = vi.fn()
    render(<ApproachModal
      driver={mkDriver()}
      remainingCap={150_000_000}
      rosterSlots={{ car01: null, car02: null, reserve: null }}
      currentPhase="management"
      evaluate={mkAcceptOffer()}
      onClose={onClose}
      onSubmit={vi.fn()}
    />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
