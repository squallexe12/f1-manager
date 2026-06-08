import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PracticeBroadcastChrome } from '@/components/strategy/practice-broadcast-chrome'

function setup(over: Partial<Parameters<typeof PracticeBroadcastChrome>[0]> = {}) {
  render(
    <PracticeBroadcastChrome
      sessionLabel="FP1"
      sessionName="Free Practice 1"
      timeRemaining={3600}
      status="running"
      currentSpeed={1}
      onSetSpeed={vi.fn()}
      onPause={vi.fn()}
      onResume={vi.fn()}
      tickerEntries={[]}
      {...over}
    />,
  )
}

describe('PracticeBroadcastChrome', () => {
  it('shows the session label and a countdown clock', () => {
    setup()
    expect(screen.getByText('FP1')).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('60:00')
  })

  it('does NOT render a lap counter in any form (practice has no laps)', () => {
    const { container } = render(
      <PracticeBroadcastChrome
        sessionLabel="FP1"
        sessionName="Free Practice 1"
        timeRemaining={3600}
        status="running"
        currentSpeed={1}
        onSetSpeed={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        tickerEntries={[]}
      />,
    )
    // No "lap" label in any case, and no "n/n" lap-counter numeric pattern.
    expect(screen.queryByText(/lap/i)).not.toBeInTheDocument()
    expect(container.textContent ?? '').not.toMatch(/\d+\s*\/\s*\d+/)
  })

  it('reuses the sim speed control', () => {
    setup()
    expect(screen.getByText('SIM')).toBeInTheDocument()
  })

  it('reflects the paused status', () => {
    setup({ status: 'paused' })
    expect(screen.getByText('⏸ PAUSED')).toBeInTheDocument()
  })
})
