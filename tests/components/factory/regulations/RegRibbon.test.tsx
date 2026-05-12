import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RegRibbon } from '@/components/factory/regulations/RegRibbon'

describe('RegRibbon', () => {
  it('renders one strip per reg returned by regsForCard("aero")', () => {
    render(<RegRibbon card="aero" />)
    expect(screen.getByText('ACTIVE AERO')).toBeInTheDocument()
  })

  it('renders 4 stacked strips for the power-unit card', () => {
    render(<RegRibbon card="power-unit" />)
    expect(screen.getByText('NO MGU-H')).toBeInTheDocument()
    expect(screen.getByText('50/50 HYBRID SPLIT')).toBeInTheDocument()
    expect(screen.getByText('SUSTAINABLE FUEL')).toBeInTheDocument()
    expect(screen.getByText('PU ALLOCATION')).toBeInTheDocument()
  })

  it('briefing is collapsed by default; clicking the strip expands it', () => {
    render(<RegRibbon card="aero" />)
    const button = screen.getByRole('button', { name: /ACTIVE AERO/i })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/Straight Mode/i)).toBeInTheDocument()
  })

  it('clicking the strip a second time collapses it', () => {
    render(<RegRibbon card="aero" />)
    const button = screen.getByRole('button', { name: /ACTIVE AERO/i })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('renders one ribbon for the car-performance card', () => {
    const { container } = render(<RegRibbon card="car-performance" />)
    expect(container.querySelectorAll('.reg-ribbon').length).toBe(1)
  })
})
