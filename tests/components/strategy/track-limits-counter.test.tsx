import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TrackLimitsCounter } from '@/components/strategy/track-limits-counter'

describe('<TrackLimitsCounter>', () => {
  it('renders nothing when the driver has zero strikes', () => {
    const { container } = render(<TrackLimitsCounter strikes={0} threshold={4} driverLabel="NOR" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders ⚠ N/threshold once strikes accrue', () => {
    render(<TrackLimitsCounter strikes={2} threshold={4} driverLabel="NOR" />)
    const el = screen.getByRole('status')
    expect(el).toHaveTextContent('2/4')
    expect(el).toHaveAttribute('aria-label', expect.stringContaining('NOR'))
  })

  it('flags assertively at or above the threshold', () => {
    render(<TrackLimitsCounter strikes={4} threshold={4} driverLabel="NOR" />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'assertive')
  })
})
