import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DriverTabs } from '@/components/drivers/driver-tabs'

const mkDriver = (id: string, name: string, isReserve = false) => ({
  id, firstName: name, lastName: 'X', shortName: id.slice(0, 3).toUpperCase(),
  attributes: { pace: 80, racecraft: 80, experience: 60, mentality: 70, marketability: 60, developmentPotential: 70 },
  isReserve,
} as any)

describe('<DriverTabs>', () => {
  it('renders 3 tabs (CAR-01, CAR-02, RESERVE)', () => {
    render(<DriverTabs
      roster={{ car01: mkDriver('a', 'Alice'), car02: mkDriver('b', 'Bob'), reserve: mkDriver('c', 'Carl', true) }}
      teamColor="oklch(0.62 0.20 265)"
      active="CAR-01"
      onChange={vi.fn()}
    />)
    expect(screen.getByText(/ALICE X/)).toBeInTheDocument()
    expect(screen.getByText(/BOB X/)).toBeInTheDocument()
    expect(screen.getByText(/CARL X/)).toBeInTheDocument()
  })

  it('calls onChange with tab id on click', () => {
    const onChange = vi.fn()
    render(<DriverTabs
      roster={{ car01: mkDriver('a', 'Alice'), car02: mkDriver('b', 'Bob'), reserve: mkDriver('c', 'Carl', true) }}
      teamColor="oklch(0.62 0.20 265)"
      active="CAR-01"
      onChange={onChange}
    />)
    fireEvent.click(screen.getByText(/CARL X/).closest('button')!)
    expect(onChange).toHaveBeenCalledWith('RESERVE')
  })
})
