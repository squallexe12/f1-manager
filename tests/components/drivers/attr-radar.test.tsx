import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AttrRadar } from '@/components/drivers/attr-radar'

const attrs = { pace: 97, racecraft: 96, experience: 92, mentality: 90, marketability: 95, developmentPotential: 50 }
const peer = { pace: 80, racecraft: 78, experience: 75, mentality: 72, marketability: 68, developmentPotential: 65 }

describe('<AttrRadar>', () => {
  it('renders all 6 attribute labels', () => {
    render(<AttrRadar attrs={attrs} peer={peer} color="oklch(0.62 0.20 265)" />)
    expect(screen.getByText('PAC')).toBeInTheDocument()
    expect(screen.getByText('RCR')).toBeInTheDocument()
    expect(screen.getByText('EXP')).toBeInTheDocument()
    expect(screen.getByText('MEN')).toBeInTheDocument()
    expect(screen.getByText('MKT')).toBeInTheDocument()
    expect(screen.getByText('POT')).toBeInTheDocument()
  })

  it('renders attribute values as text', () => {
    render(<AttrRadar attrs={attrs} peer={peer} color="oklch(0.62 0.20 265)" />)
    expect(screen.getByText('97')).toBeInTheDocument()
    expect(screen.getByText('96')).toBeInTheDocument()
    expect(screen.getByText('92')).toBeInTheDocument()
    expect(screen.getByText('90')).toBeInTheDocument()
    expect(screen.getByText('95')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
  })

  it('renders the expected SVG path elements (value path + peer path + ring paths)', () => {
    const { container } = render(<AttrRadar attrs={attrs} peer={peer} color="#00e5ff" />)
    // 4 ring paths + 1 value path + 1 peer path = 6 paths minimum
    const paths = container.querySelectorAll('path')
    expect(paths.length).toBeGreaterThanOrEqual(6)
  })

  it('renders 6 dot circles at vertex points', () => {
    const { container } = render(<AttrRadar attrs={attrs} peer={peer} color="#ccff00" />)
    // 6 vertex circles + 1 center circle
    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBe(7)
  })
})
