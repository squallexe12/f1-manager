import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ScoutPanel } from '@/components/drivers/scout-panel'
import type { Driver } from '@/types/driver'

const mkScout = (id: string, pace: number, pot: number, overrides: Partial<Driver> = {}): Driver => ({
  id,
  firstName: 'Scout',
  lastName: id.charAt(0).toUpperCase() + id.slice(1),
  shortName: id.slice(0, 3).toUpperCase(),
  nationality: 'GBR',
  age: 22,
  teamId: null,
  attributes: { pace, racecraft: 75, experience: 40, mentality: 70, marketability: 65, developmentPotential: pot },
  mood: { motivation: 80, confidence: 75, frustration: 20 },
  contract: { salary: 1500000, termEndSeason: 1, performanceBonuses: [], releaseClause: null },
  seasonStats: { points: 0, wins: 0, podiums: 0, poles: 0, dnfs: 0, penalties: 0, bestFinish: 0, averageFinish: 0, lastProcessedRound: 0 },
  rivalries: [],
  peakAge: 24,
  declineRate: 0.3,
  isReserve: false,
  isF2: true,
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
  scoutingReports: 4,
  ...overrides,
})

describe('<ScoutPanel>', () => {
  it('sorts scouts by composite (pace + developmentPotential) descending', () => {
    const scouts = [
      mkScout('alpha', 80, 70),  // composite 150
      mkScout('beta', 90, 95),   // composite 185 — highest
      mkScout('gamma', 85, 80),  // composite 165
    ]
    const { container } = render(<ScoutPanel scouts={scouts} onApproach={vi.fn()} onFileReport={vi.fn()} />)
    const rows = container.querySelectorAll('.scout-row:not(.head)')
    expect(rows[0].textContent).toContain('BET') // beta shortName
    expect(rows[1].textContent).toContain('GAM') // gamma shortName
    expect(rows[2].textContent).toContain('ALP') // alpha shortName
  })

  it('renders HOT signal pill for hot signal', () => {
    const scouts = [mkScout('yoshida', 86, 95, { scoutSignal: 'hot' })]
    const { container } = render(<ScoutPanel scouts={scouts} onApproach={vi.fn()} onFileReport={vi.fn()} />)
    const hotPill = container.querySelector('.signal.hot')
    expect(hotPill).toBeTruthy()
    expect(hotPill?.textContent).toBe('HOT')
  })

  it('renders TRACKING signal pill for tracking signal', () => {
    const scouts = [mkScout('novak', 80, 88, { scoutSignal: 'tracking' })]
    const { container } = render(<ScoutPanel scouts={scouts} onApproach={vi.fn()} onFileReport={vi.fn()} />)
    const trackPill = container.querySelector('.signal.tracking')
    expect(trackPill).toBeTruthy()
    expect(trackPill?.textContent).toBe('TRACKING')
  })

  it('renders AVAILABLE signal pill for available signal', () => {
    const scouts = [mkScout('ferrara', 82, 30, { scoutSignal: 'available' })]
    const { container } = render(<ScoutPanel scouts={scouts} onApproach={vi.fn()} onFileReport={vi.fn()} />)
    const availPill = container.querySelector('.signal.available')
    expect(availPill).toBeTruthy()
    expect(availPill?.textContent).toBe('AVAILABLE')
  })

  it('calls onFileReport with driver id when File Report is clicked', () => {
    const onFileReport = vi.fn()
    const scouts = [mkScout('yoshida', 86, 95, { id: 'yoshida' })]
    render(<ScoutPanel scouts={scouts} onApproach={vi.fn()} onFileReport={onFileReport} />)
    fireEvent.click(screen.getByText('File Report'))
    expect(onFileReport).toHaveBeenCalledWith('yoshida')
  })

  it('calls onApproach with driver id when Approach is clicked', () => {
    const onApproach = vi.fn()
    const scouts = [mkScout('novak', 80, 88, { id: 'novak' })]
    render(<ScoutPanel scouts={scouts} onApproach={onApproach} onFileReport={vi.fn()} />)
    fireEvent.click(screen.getByText('Approach'))
    expect(onApproach).toHaveBeenCalledWith('novak')
  })

  it('renders F2 badge for F2 scouts', () => {
    const scouts = [mkScout('f2driver', 80, 90, { isF2: true })]
    render(<ScoutPanel scouts={scouts} onApproach={vi.fn()} onFileReport={vi.fn()} />)
    expect(screen.getByText('F2')).toBeInTheDocument()
  })

  it('renders FREE AGENT badge for non-F2 scouts', () => {
    const scouts = [mkScout('veteran', 82, 30, { isF2: false, age: 33 })]
    render(<ScoutPanel scouts={scouts} onApproach={vi.fn()} onFileReport={vi.fn()} />)
    expect(screen.getByText('FREE AGENT')).toBeInTheDocument()
  })

  it('renders RECOMMENDED header with top scout name', () => {
    const scouts = [
      mkScout('alpha', 80, 70),
      mkScout('beta', 90, 95),
    ]
    render(<ScoutPanel scouts={scouts} onApproach={vi.fn()} onFileReport={vi.fn()} />)
    expect(screen.getByText(/RECOMMENDED/)).toBeInTheDocument()
    expect(screen.getByText(/BETA/)).toBeInTheDocument()
  })
})
