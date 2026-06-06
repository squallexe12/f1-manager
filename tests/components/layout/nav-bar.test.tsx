import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

let mockPath = '/paddock'
vi.mock('next/navigation', () => ({ usePathname: () => mockPath }))
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const setActivePage = vi.fn()
vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: any) => selector({ setActivePage }),
}))

import { NavBar } from '@/components/layout/nav-bar'

const ALL = ['Paddock', 'Factory', 'Drivers', 'Strategy', 'Finance', 'Calendar', 'Regs']

describe('<NavBar> (F1 wrapper)', () => {
  beforeEach(() => {
    setActivePage.mockClear()
    mockPath = '/paddock'
  })

  it('renders all 7 destinations', () => {
    render(<NavBar />)
    for (const name of ALL) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument()
    }
  })

  it('calls setActivePage with the correct PageId on click', () => {
    render(<NavBar />)
    fireEvent.click(screen.getByRole('link', { name: 'Finance' }))
    expect(setActivePage).toHaveBeenCalledWith('finance')
  })

  it('reflects the active route via aria-current', () => {
    mockPath = '/drivers'
    render(<NavBar />)
    expect(screen.getByRole('link', { name: 'Drivers' })).toHaveAttribute('aria-current', 'page')
  })
})
