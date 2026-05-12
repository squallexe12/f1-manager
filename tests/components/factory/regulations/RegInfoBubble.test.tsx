import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RegInfoBubble } from '@/components/factory/regulations/RegInfoBubble'

describe('RegInfoBubble', () => {
  it('renders children with a dotted-underline wrapper', () => {
    const { container } = render(<RegInfoBubble term="ers">ERS</RegInfoBubble>)
    expect(container.querySelector('.reg-bubble-underline')).toBeInTheDocument()
    expect(screen.getByText('ERS')).toBeInTheDocument()
  })

  it('tooltip is hidden by default and appears on click', () => {
    render(<RegInfoBubble term="ers">ERS</RegInfoBubble>)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('ERS'))
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    expect(screen.getByRole('tooltip').textContent).toMatch(/Energy Recovery System/i)
  })

  it('Enter on the focused trigger opens the tooltip', () => {
    render(<RegInfoBubble term="ers">ERS</RegInfoBubble>)
    const trigger = screen.getByRole('button', { name: /ERS/i })
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
  })

  it('renders the "Read more →" link when the term has seeAlso', () => {
    render(<RegInfoBubble term="ers">ERS</RegInfoBubble>)
    fireEvent.click(screen.getByText('ERS'))
    expect(screen.getByText(/Read more/i)).toBeInTheDocument()
  })

  it('console.warns once for an unknown term and still renders children', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // @ts-expect-error — runtime defensive test
    render(<RegInfoBubble term="not-a-real-term">XYZ</RegInfoBubble>)
    expect(spy).toHaveBeenCalled()
    expect(screen.getByText('XYZ')).toBeInTheDocument()
    spy.mockRestore()
  })
})
