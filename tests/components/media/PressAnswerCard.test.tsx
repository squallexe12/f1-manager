import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PressAnswerCard } from '@/components/media/PressAnswerCard'
import type { PressAnswer } from '@/types/media'

// CSS import in PressRoomModal is fine; this component does NOT import it.
// No mocks needed here — PressAnswerCard is a pure presentational component.

const makeAnswer = (overrides: Partial<PressAnswer> = {}): PressAnswer => ({
  id: 'a1',
  text: 'We will take it race by race.',
  tone: 'diplomatic',
  delta: {},
  ...overrides,
})

describe('<PressAnswerCard>', () => {
  it('renders the tone label in uppercase', () => {
    render(
      <PressAnswerCard
        answer={makeAnswer({ tone: 'aggressive' })}
        selected={false}
        onSelect={() => {}}
      />,
    )
    expect(screen.getByText('AGGRESSIVE')).toBeInTheDocument()
  })

  it('renders symbolic delta hints — no raw numbers in the DOM', () => {
    const answer = makeAnswer({
      delta: { driverMood: 4, sponsorKPI: 1, prestige: -1 },
    })
    render(
      <PressAnswerCard answer={answer} selected={false} onSelect={() => {}} />,
    )

    // Positive driverMood → ▲▲ mood (ceil(4/2) = 2 arrows)
    expect(screen.getByText(/▲▲ mood/)).toBeInTheDocument()
    // Positive sponsorKPI → ▲ KPI
    expect(screen.getByText(/▲ KPI/)).toBeInTheDocument()
    // Negative prestige → ▼ prestige
    expect(screen.getByText(/▼ prestige/)).toBeInTheDocument()

    // Raw numbers must NOT appear in the accessible DOM
    const container = document.body
    expect(container.textContent).not.toMatch(/\b4\b/)
    expect(container.textContent).not.toMatch(/\b-1\b/)
  })

  it('calls onSelect when the button is clicked', () => {
    const onSelect = vi.fn()
    render(
      <PressAnswerCard
        answer={makeAnswer()}
        selected={false}
        onSelect={onSelect}
      />,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('does not call onSelect when disabled', () => {
    const onSelect = vi.fn()
    render(
      <PressAnswerCard
        answer={makeAnswer()}
        selected={false}
        onSelect={onSelect}
        disabled={true}
      />,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('renders rumorWeight as warning arrows when total > 0', () => {
    const answer = makeAnswer({
      delta: { rumorWeight: { inflammatory: 2 } },
    })
    render(
      <PressAnswerCard answer={answer} selected={false} onSelect={() => {}} />,
    )
    expect(screen.getByText(/⚠⚠ rumor/)).toBeInTheDocument()
  })

  it('renders no delta hints when all deltas are 0 or undefined', () => {
    const answer = makeAnswer({ delta: {} })
    const { container } = render(
      <PressAnswerCard answer={answer} selected={false} onSelect={() => {}} />,
    )
    // The delta span exists but should be empty
    const deltaSpan = container.querySelector('.press-answer__deltas')
    expect(deltaSpan?.textContent?.trim()).toBe('')
  })
})
