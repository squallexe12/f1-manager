import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ContractNegotiationModal } from '@/components/drivers/contract-negotiation-modal'
import type { ContractEvaluation } from '@/engine/drivers/contract-engine'

const commit = vi.fn()
let evalResult: ContractEvaluation = { accepted: true, satisfaction: 80, counterOffer: null }

vi.mock('@/hooks/use-contract-negotiation', () => ({
  useContractNegotiation: (driverId: string | null) =>
    driverId === null
      ? null
      : {
          driver: { id: driverId, firstName: 'Lando', lastName: 'Norris', shortName: 'NOR',
            contract: { salary: 20_000_000, termEndSeason: 2, performanceBonuses: [], releaseClause: null } },
          marketValue: 22_000_000,
          currentSalaries: 45_000_000,
          budgetCap: 215_000_000,
          evaluate: () => evalResult,
          previewSalaries: () => 50_000_000,
          commit,
        },
}))

describe('ContractNegotiationModal', () => {
  beforeEach(() => {
    commit.mockClear()
    evalResult = { accepted: true, satisfaction: 80, counterOffer: null }
  })

  it('renders nothing when driverId is null', () => {
    const { container } = render(<ContractNegotiationModal driverId={null} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows the driver name and market value', () => {
    render(<ContractNegotiationModal driverId="lando" onClose={vi.fn()} />)
    expect(screen.getByText(/Lando Norris/i)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('commits when the driver accepts the offer', () => {
    render(<ContractNegotiationModal driverId="lando" onClose={vi.fn()} />)
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Make Offer/i })) })
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Sign/i })) })
    expect(commit).toHaveBeenCalled()
  })

  it('shows the counter-offer path when the driver counters', () => {
    evalResult = {
      accepted: false, satisfaction: 45,
      counterOffer: { salary: 30_000_000, termLength: 2, performanceBonuses: [], releaseClause: null },
    }
    render(<ContractNegotiationModal driverId="lando" onClose={vi.fn()} />)
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Make Offer/i })) })
    expect(screen.getByText(/counter/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Accept counter/i })).toBeInTheDocument()
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(<ContractNegotiationModal driverId="lando" onClose={onClose} />)
    act(() => { fireEvent.keyDown(window, { key: 'Escape' }) })
    expect(onClose).toHaveBeenCalled()
  })

  it('adds a performance-bonus row', () => {
    render(<ContractNegotiationModal driverId="lando" onClose={vi.fn()} />)
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Add bonus/i })) })
    expect(screen.getByRole('button', { name: /Remove bonus 1/i })).toBeInTheDocument()
  })
})
