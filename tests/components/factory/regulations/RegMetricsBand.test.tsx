import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RegMetricsBand } from '@/components/factory/regulations/RegMetricsBand'
import { useGameStore } from '@/stores/game-store'

vi.mock('@/stores/game-store', () => ({
  useGameStore: vi.fn(),
}))

function fakeWorld() {
  const baseTeam = {
    id: 'player',
    rndUpgrades: [],
    car: { straightSpeed: 60 },
    penaltiesTaken: 0,
  }
  const otherTeam = { ...baseTeam, id: 'other' }
  return {
    teams: [baseTeam, otherTeam],
    gameState: { playerTeamId: 'player' },
  }
}

describe('RegMetricsBand', () => {
  beforeEach(() => {
    ;(useGameStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((sel: any) =>
      sel({ world: fakeWorld() }),
    )
  })

  it('renders the "2026 READINESS" section header', () => {
    render(<RegMetricsBand />)
    expect(screen.getByText(/2026 READINESS/i)).toBeInTheDocument()
  })

  it('renders all 3 tile labels', () => {
    render(<RegMetricsBand />)
    expect(screen.getByText(/ACTIVE AERO MATURITY/i)).toBeInTheDocument()
    expect(screen.getByText(/HYBRID EFFICIENCY/i)).toBeInTheDocument()
    expect(screen.getByText(/GRID 2026 ADOPTION RANK/i)).toBeInTheDocument()
  })

  it('clicking a "Learn the rule" link opens a single shared briefing slot', () => {
    render(<RegMetricsBand />)
    const links = screen.getAllByRole('button', { name: /learn the rule/i })
    fireEvent.click(links[0])
    expect(screen.getByTestId('reg-band-briefing')).toBeInTheDocument()
  })

  it('clicking a second "Learn the rule" replaces the briefing (one open at a time)', () => {
    render(<RegMetricsBand />)
    const links = screen.getAllByRole('button', { name: /learn the rule/i })
    fireEvent.click(links[0])
    fireEvent.click(links[1])
    expect(screen.getAllByTestId('reg-band-briefing')).toHaveLength(1)
  })
})
