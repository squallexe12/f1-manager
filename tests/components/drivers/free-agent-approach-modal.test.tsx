import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FreeAgentApproachModal } from '@/components/drivers/free-agent-approach-modal'
import type { Driver } from '@/types/driver'

const commit = vi.fn()
const driver = { id: 'a', firstName: 'Aaa', lastName: 'One', teamId: null, contract: null, isReserve: false,
  attributes: { pace: 90, racecraft: 85, experience: 70, mentality: 75, marketability: 80, developmentPotential: 88 } } as unknown as Driver

vi.mock('@/hooks/use-free-agent-signing', () => ({
  useFreeAgentSigning: (id: string | null) => id === null ? null : ({
    driver, prestige: 'B', askingSalary: 6_000_000, acceptanceFloor: 6_000_000,
    budgetCap: 215_000_000, currentSalaries: 20_000_000,
    slots: [
      { slot: 'CAR-01', occupant: { id: 'x', firstName: 'Occ', lastName: 'Upant' } },
      { slot: 'CAR-02', occupant: { id: 'y', firstName: 'Two', lastName: 'Driver' } },
      { slot: 'RESERVE', occupant: null },
    ],
    evaluate: (o: { salary: number }) => o.salary >= 6_000_000 ? { accepted: true, floor: 6_000_000 } : { accepted: false, floor: 6_000_000, reason: 'below market' },
    projectedSalaries: (o: { salary: number }) => 20_000_000 + o.salary,
    commit,
  }),
}))

describe('FreeAgentApproachModal', () => {
  it('renders nothing when driverId is null', () => {
    const { container } = render(<FreeAgentApproachModal driverId={null} onClose={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('signs into an empty slot when the offer is accepted', () => {
    render(<FreeAgentApproachModal driverId="a" onClose={() => {}} />)
    // RESERVE slot is empty → no displacement. Submit the default (asking) offer.
    fireEvent.click(screen.getByRole('button', { name: /evaluate|make offer/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm|sign/i }))
    expect(commit).toHaveBeenCalled()
  })
})
