import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DriverMarketPanel } from '@/components/drivers/driver-market-panel'
import type { Driver } from '@/types/driver'

function fakeAgent(id: string, first: string, last: string): { driver: Driver; signal: 'hot' | 'tracking' | 'available'; asking: number } {
  return {
    driver: { id, firstName: first, lastName: last, teamId: null, contract: null, isReserve: false,
      attributes: { pace: 80, racecraft: 80, experience: 70, mentality: 70, marketability: 70, developmentPotential: 80 } } as unknown as Driver,
    signal: 'hot',
    asking: 6_000_000,
  }
}

describe('DriverMarketPanel', () => {
  it('renders one card per free agent', () => {
    render(<DriverMarketPanel agents={[fakeAgent('a', 'Aaa', 'One'), fakeAgent('b', 'Bbb', 'Two')]} onApproach={() => {}} />)
    expect(screen.getByText(/AAA ONE/i)).toBeTruthy()
    expect(screen.getByText(/BBB TWO/i)).toBeTruthy()
  })

  it('fires onApproach with the driver id', () => {
    const onApproach = vi.fn()
    render(<DriverMarketPanel agents={[fakeAgent('a', 'Aaa', 'One')]} onApproach={onApproach} />)
    fireEvent.click(screen.getByRole('button', { name: /approach/i }))
    expect(onApproach).toHaveBeenCalledWith('a')
  })

  it('shows an empty state when there are no free agents', () => {
    render(<DriverMarketPanel agents={[]} onApproach={() => {}} />)
    expect(screen.getByText(/no free agents/i)).toBeTruthy()
  })
})
