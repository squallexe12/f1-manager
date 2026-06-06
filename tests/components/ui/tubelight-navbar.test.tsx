import type { ComponentPropsWithoutRef } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Home, Factory } from 'lucide-react'
import { TubelightNavBar } from '@/components/ui/tubelight-navbar'

let mockPath = '/paddock'
vi.mock('next/navigation', () => ({ usePathname: () => mockPath }))
// next/link needs the App Router context in app-router; stub to a plain anchor.
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: ComponentPropsWithoutRef<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const items = [
  { name: 'Paddock', url: '/paddock', icon: Home },
  { name: 'Factory', url: '/factory', icon: Factory },
]

describe('<TubelightNavBar>', () => {
  beforeEach(() => {
    mockPath = '/paddock'
  })

  it('renders every item as a labelled link', () => {
    render(<TubelightNavBar items={items} />)
    expect(screen.getByRole('link', { name: 'Paddock' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Factory' })).toBeInTheDocument()
  })

  it('marks the active item (from pathname) with aria-current="page"', () => {
    mockPath = '/factory'
    render(<TubelightNavBar items={items} />)
    expect(screen.getByRole('link', { name: 'Factory' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Paddock' })).not.toHaveAttribute('aria-current')
  })

  it('fires onSelect when an item is clicked', () => {
    const onSelect = vi.fn()
    render(<TubelightNavBar items={[{ name: 'Factory', url: '/factory', icon: Factory, onSelect }]} />)
    fireEvent.click(screen.getByRole('link', { name: 'Factory' }))
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('exposes a navigation landmark', () => {
    render(<TubelightNavBar items={items} />)
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
  })
})
