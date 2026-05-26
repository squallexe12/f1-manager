import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { CautionFlash } from '@/components/strategy/caution-flash'

describe('<CautionFlash>', () => {
  it('renders an aria-hidden overlay element', () => {
    const { container } = render(<CautionFlash flag="sc" />)
    const overlay = container.querySelector('[data-caution-flash]')
    expect(overlay).not.toBeNull()
    expect(overlay).toHaveAttribute('aria-hidden', 'true')
  })

  it('is inert (no flash element) under green', () => {
    const { container } = render(<CautionFlash flag="green" />)
    expect(container.querySelector('[data-caution-flash][data-active="true"]')).toBeNull()
  })

  it('marks the overlay active under a caution flag', () => {
    const { container } = render(<CautionFlash flag="yellow" />)
    expect(container.querySelector('[data-caution-flash][data-active="true"]')).not.toBeNull()
  })
})
