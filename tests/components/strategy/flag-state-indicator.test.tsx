import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FlagStateIndicator } from '@/components/strategy/flag-state-indicator'

describe('<FlagStateIndicator>', () => {
  it('renders GREEN with a status role when racing', () => {
    render(<FlagStateIndicator flag="green" />)
    const el = screen.getByRole('status')
    expect(el).toHaveTextContent('GREEN')
    expect(el).toHaveAttribute('aria-live', 'polite')
  })

  it('renders SAFETY CAR assertively under sc', () => {
    render(<FlagStateIndicator flag="sc" />)
    const el = screen.getByRole('status')
    expect(el).toHaveTextContent('SAFETY CAR')
    expect(el).toHaveAttribute('aria-live', 'assertive')
  })

  it('renders YELLOW and RED labels', () => {
    const { rerender } = render(<FlagStateIndicator flag="yellow" />)
    expect(screen.getByRole('status')).toHaveTextContent('YELLOW')
    rerender(<FlagStateIndicator flag="red" />)
    expect(screen.getByRole('status')).toHaveTextContent('RED FLAG')
  })
})
