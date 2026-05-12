import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RegMetricTile } from '@/components/factory/regulations/RegMetricTile'

describe('RegMetricTile', () => {
  it('renders label, value, and suffix', () => {
    render(<RegMetricTile label="Active Aero Maturity" value={42} suffix="%" footnote="Aero R&D progress" />)
    expect(screen.getByText('ACTIVE AERO MATURITY')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('%')).toBeInTheDocument()
    expect(screen.getByText(/Aero R&D progress/i)).toBeInTheDocument()
  })

  it('renders the P{value}/{ofValue} format for the rank tile', () => {
    render(
      <RegMetricTile
        label="Grid 2026 Adoption Rank"
        value={3}
        prefix="P"
        ofValue={11}
        footnote="Compared to the field"
      />,
    )
    expect(screen.getByText('P')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('/ 11')).toBeInTheDocument()
  })

  it('rank tile applies the lime color class for P1-3', () => {
    const { container } = render(
      <RegMetricTile label="Rank" value={2} prefix="P" ofValue={11} footnote="x" />,
    )
    expect(container.querySelector('.reg-tile-value')).toHaveClass('tier-lime')
  })

  it('rank tile applies the amber color class for P8-11', () => {
    const { container } = render(
      <RegMetricTile label="Rank" value={10} prefix="P" ofValue={11} footnote="x" />,
    )
    expect(container.querySelector('.reg-tile-value')).toHaveClass('tier-amber')
  })

  it('calls onSeeAlso with the regSeeAlso id when the link is clicked', () => {
    const spy = vi.fn()
    render(
      <RegMetricTile
        label="Active Aero Maturity"
        value={42}
        suffix="%"
        footnote="x"
        regSeeAlso="active-aero"
        onSeeAlso={spy}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /learn the rule/i }))
    expect(spy).toHaveBeenCalledWith('active-aero')
  })
})
