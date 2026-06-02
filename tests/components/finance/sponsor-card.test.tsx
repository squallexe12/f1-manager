import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SponsorCard } from '@/components/finance/sponsor-card'
import type { Sponsor } from '@/types/finance'

function sponsor(partial: Partial<Sponsor> = {}): Sponsor {
  return {
    id: 'sp-petrox', name: 'PetroX Energy', tier: 'title',
    annualValue: 45_000_000, bonusValue: 10_000_000,
    kpis: [
      { description: 'Finish in top 3 constructors', target: 3, current: 2, met: true },
      { description: 'Win at least 3 races', target: 3, current: 1, met: false },
    ],
    satisfaction: 80, contractEndSeason: 3, minimumPrestige: 'A',
    ...partial,
  }
}

describe('SponsorCard', () => {
  it('renders a position KPI as "P{current} · target top {target}" not a raw ratio', () => {
    render(<SponsorCard sponsor={sponsor()} currentSeason={1} />)
    expect(screen.getByText(/P2 · target top 3/i)).toBeInTheDocument()
  })

  it('shows "At Risk" only below the engine threshold (<30), not at 35', () => {
    const { rerender } = render(<SponsorCard sponsor={sponsor({ satisfaction: 35 })} currentSeason={1} />)
    expect(screen.queryByText(/At Risk/i)).not.toBeInTheDocument()
    rerender(<SponsorCard sponsor={sponsor({ satisfaction: 20 })} currentSeason={1} />)
    expect(screen.getByText(/At Risk/i)).toBeInTheDocument()
  })

  it('lights up bonus when all KPIs met', () => {
    const allMet = sponsor({ kpis: [
      { description: 'Finish in top 3 constructors', target: 3, current: 2, met: true },
      { description: 'Win at least 3 races', target: 3, current: 3, met: true },
    ] })
    render(<SponsorCard sponsor={allMet} currentSeason={1} />)
    expect(screen.getByText(/Bonus earned|Bonus secured/i)).toBeInTheDocument()
  })
})
