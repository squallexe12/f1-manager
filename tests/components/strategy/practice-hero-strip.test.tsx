import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PracticeHeroStrip } from '@/components/strategy/practice-hero-strip'

describe('PracticeHeroStrip', () => {
  it('shows a dash for the setup leader before any FP has run', () => {
    render(<PracticeHeroStrip timeRemaining={3600} timeBudget={3600} leader={null} setsRemaining={14} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows the leading driver code and confidence when present', () => {
    render(
      <PracticeHeroStrip
        timeRemaining={1800}
        timeBudget={3600}
        leader={{ code: 'NOR', teamColor: '#FF8000', setupConfidence: 72 }}
        setsRemaining={9}
      />,
    )
    expect(screen.getByText('NOR')).toBeInTheDocument()
    expect(screen.getByText('72')).toBeInTheDocument()
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })

  it('renders the session countdown', () => {
    render(<PracticeHeroStrip timeRemaining={3600} timeBudget={3600} leader={null} setsRemaining={14} />)
    expect(screen.getByText('60:00')).toBeInTheDocument()
  })
})
