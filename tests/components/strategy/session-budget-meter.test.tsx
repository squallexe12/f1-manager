import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SessionBudgetMeter } from '@/components/strategy/session-budget-meter'
import type { TireCompound } from '@/types/race'

const LEDGER: { compound: TireCompound; role: 'hard' | 'medium' | 'soft'; setsRemaining: number }[] = [
  { compound: 'C2' as TireCompound, role: 'hard', setsRemaining: 3 },
  { compound: 'C3' as TireCompound, role: 'medium', setsRemaining: 4 },
  { compound: 'C4' as TireCompound, role: 'soft', setsRemaining: 1 },
]

describe('SessionBudgetMeter', () => {
  it('renders nothing when not visible (PLAN phase)', () => {
    const { container } = render(
      <SessionBudgetMeter visible={false} timeRemaining={1800} timeBudget={3600} ledger={LEDGER} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the session clock and per-compound set counts when visible', () => {
    render(<SessionBudgetMeter visible timeRemaining={1800} timeBudget={3600} ledger={LEDGER} />)
    expect(screen.getByRole('timer')).toHaveTextContent('30:00')
    expect(screen.getByText('hard')).toBeInTheDocument()
    expect(screen.getByText('soft')).toBeInTheDocument()
  })

  it('flags a low reserve (≤1 set) with a LOW warning', () => {
    render(<SessionBudgetMeter visible timeRemaining={1800} timeBudget={3600} ledger={LEDGER} />)
    expect(screen.getByText('LOW')).toBeInTheDocument()
  })

  it('does not warn when all compounds are above the threshold', () => {
    const stocked = LEDGER.map((r) => ({ ...r, setsRemaining: 5 }))
    render(<SessionBudgetMeter visible timeRemaining={1800} timeBudget={3600} ledger={stocked} />)
    expect(screen.queryByText('LOW')).not.toBeInTheDocument()
  })
})
