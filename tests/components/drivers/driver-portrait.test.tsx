import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DriverPortrait } from '@/components/drivers/driver-portrait'

const baseDriver = (overrides: Record<string, unknown> = {}) => ({
  id: 'ver',
  firstName: 'Max',
  lastName: 'Verstappen',
  shortName: 'VER',
  nationality: 'NL',
  age: 27,
  teamId: 'red-bull',
  portraitUrl: null,
  ...overrides,
} as any)

describe('<DriverPortrait>', () => {
  it('renders SVG stripe placeholder when portraitUrl is null', () => {
    const { container } = render(<DriverPortrait driver={baseDriver()} color="oklch(0.62 0.20 265)" />)
    const svg = container.querySelector('svg.portrait-stripes')
    expect(svg).not.toBeNull()
    expect(screen.getByText(/MAX VERSTAPPEN/)).toBeInTheDocument()
    expect(screen.getByText(/DROP IMAGE/)).toBeInTheDocument()
  })

  it('renders an <img> when portraitUrl is set', () => {
    const { container } = render(
      <DriverPortrait driver={baseDriver({ portraitUrl: '/drivers/ver.jpg' })} color="oklch(0.62 0.20 265)" />
    )
    const img = container.querySelector('img.portrait-img')
    expect(img).not.toBeNull()
    expect(img?.getAttribute('src')).toBe('/drivers/ver.jpg')
    expect(img?.getAttribute('alt')).toMatch(/Max Verstappen/)
  })

  it('uses driver shortName in SVG pattern id to avoid collisions', () => {
    const { container } = render(<DriverPortrait driver={baseDriver()} color="#fff" />)
    const pattern = container.querySelector('pattern[id^="stripes-VER"]')
    expect(pattern).not.toBeNull()
  })
})
