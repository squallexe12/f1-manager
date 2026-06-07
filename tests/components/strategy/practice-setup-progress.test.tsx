import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PracticeSetupProgress } from '@/components/strategy/practice-setup-progress'

const DRIVERS = [
  { driverId: 'norris', code: 'NOR', teamColor: '#FF8000', setupConfidence: 60, tireDegRead: 40 },
  { driverId: 'piastri', code: 'PIA', teamColor: '#FF8000', setupConfidence: 20, tireDegRead: 10 },
]

describe('PracticeSetupProgress', () => {
  it('renders glance averages and a detail row per driver as progressbars', () => {
    render(<PracticeSetupProgress drivers={DRIVERS} />)
    // 2 glance bars + 2 bars × 2 drivers = 6 progressbars.
    expect(screen.getAllByRole('progressbar')).toHaveLength(6)
    expect(screen.getByText('NOR')).toBeInTheDocument()
    expect(screen.getByText('PIA')).toBeInTheDocument()
  })

  it('computes the team-average setup with aria-valuenow', () => {
    render(<PracticeSetupProgress drivers={DRIVERS} />)
    // avg setup = (60 + 20) / 2 = 40
    expect(screen.getByLabelText('Avg Setup')).toHaveAttribute('aria-valuenow', '40')
    // avg tire read = (40 + 10) / 2 = 25
    expect(screen.getByLabelText('Avg Tire Read')).toHaveAttribute('aria-valuenow', '25')
  })

  it('clamps values into the 0–100 ARIA range', () => {
    render(
      <PracticeSetupProgress
        drivers={[{ driverId: 'x', code: 'XXX', teamColor: '#fff', setupConfidence: 140, tireDegRead: -5 }]}
      />,
    )
    expect(screen.getByLabelText('Avg Setup')).toHaveAttribute('aria-valuenow', '100')
    expect(screen.getByLabelText('Avg Tire Read')).toHaveAttribute('aria-valuenow', '0')
  })
})
