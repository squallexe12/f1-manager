import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FpSessionSelector } from '@/components/strategy/fp-session-selector'

describe('FpSessionSelector', () => {
  it('renders FP1/FP2/FP3 with done, live, and pending states (standard weekend)', () => {
    render(<FpSessionSelector total={3} activeIndex={1} completedCount={1} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText('FP1')).toBeInTheDocument()
    expect(screen.getByText('FP2')).toBeInTheDocument()
    expect(screen.getByText('FP3')).toBeInTheDocument()
    expect(screen.getByText('✓ Done')).toBeInTheDocument()
    expect(screen.getByText('◉ Live')).toBeInTheDocument()
    // The active pill (FP2) is the current step.
    const live = screen.getByText('FP2').closest('li')
    expect(live).toHaveAttribute('aria-current', 'step')
  })

  it('renders FP1 alone for a sprint weekend (total = 1)', () => {
    render(<FpSessionSelector total={1} activeIndex={0} completedCount={0} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('FP1')).toBeInTheDocument()
    expect(screen.queryByText('FP2')).not.toBeInTheDocument()
  })

  it('shows no completed pill before any FP has run', () => {
    render(<FpSessionSelector total={3} activeIndex={0} completedCount={0} />)
    expect(screen.queryByText('✓ Done')).not.toBeInTheDocument()
  })
})
