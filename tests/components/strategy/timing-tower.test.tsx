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
})
