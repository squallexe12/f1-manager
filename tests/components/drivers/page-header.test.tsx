import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageHeader } from '@/components/drivers/page-header'

describe('<PageHeader>', () => {
  it('renders eyebrow with team name + season + round', () => {
    render(<PageHeader teamName="VANTAGE GP" season={2026} round={8}
      nextRound={{ id: 'R09', name: 'MONTRÉAL' }} constructorPos={2} rosterCount={{ active: 2, reserve: 1 }} />)
    expect(screen.getByText(/VANTAGE GP/)).toBeInTheDocument()
    expect(screen.getByText(/S2026/)).toBeInTheDocument()
    expect(screen.getByText(/R08/)).toBeInTheDocument()
  })

  it('renders next event meta', () => {
    render(<PageHeader teamName="X" season={1} round={1}
      nextRound={{ id: 'R02', name: 'MONACO' }} constructorPos={5} rosterCount={{ active: 2, reserve: 1 }} />)
    expect(screen.getByText(/MONACO/)).toBeInTheDocument()
  })
})
