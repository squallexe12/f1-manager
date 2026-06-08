import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TimingTower } from '@/components/strategy/timing-tower'

function entry(over: Partial<Parameters<typeof TimingTower>[0]['entries'][number]> = {}) {
  return {
    position: 1,
    driverId: 'd1',
    driverName: 'Lando Norris',
    teamColor: '#ff8000',
    isPlayer: false,
    gapToLeader: 0,
    lastLapTime: 88.123,
    tire: 'medium',
    retired: false,
    ...over,
  }
}

describe('TimingTower', () => {
  it('shows the gap for a running driver', () => {
    render(<TimingTower entries={[entry({ position: 2, gapToLeader: 1.234, lastLapTime: 89.5 })]} />)
    expect(screen.getByText('+1.234')).toBeInTheDocument()
    expect(screen.queryByText('DNF')).not.toBeInTheDocument()
  })

  it('shows a DNF marker instead of a gap for a retired driver', () => {
    render(<TimingTower entries={[entry({ position: 20, retired: true, lastLapTime: null })]} />)
    expect(screen.getByText('DNF')).toBeInTheDocument()
  })

  it('defaults to race mode with a LAST column header (regression guard)', () => {
    render(<TimingTower entries={[entry()]} />)
    expect(screen.getByText('LAST')).toBeInTheDocument()
    expect(screen.queryByText('BEST')).not.toBeInTheDocument()
  })

  it('switches the time column header to BEST in practice mode', () => {
    render(<TimingTower mode="practice" entries={[entry({ bestLapTime: 87.654 })]} />)
    expect(screen.getByText('BEST')).toBeInTheDocument()
    expect(screen.queryByText('LAST')).not.toBeInTheDocument()
  })

  it('renders bestLapTime in practice mode and a dash when absent', () => {
    render(
      <TimingTower
        mode="practice"
        entries={[
          entry({ position: 1, bestLapTime: 87.654, lastLapTime: 99.9 }),
          entry({ position: 2, driverId: 'd2', driverName: 'Oscar Piastri', bestLapTime: null, lastLapTime: 88.0 }),
        ]}
      />,
    )
    // Practice column reads BEST (bestLapTime), never the race lastLapTime.
    expect(screen.getByText('1:27.654')).toBeInTheDocument()
    expect(screen.queryByText('1:39.900')).not.toBeInTheDocument()
    // Driver without a best lap shows a dash.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })
})
