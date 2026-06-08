import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QualiBroadcastChrome } from '@/components/strategy/quali-broadcast-chrome'
import type { CommentaryEntry, SimSpeed } from '@/types/race'

type SessionPhase = 'idle' | 'running' | 'paused' | 'segment-end' | 'finished'

function setup(overrides: Partial<{
  segmentLabel: string
  segmentName: string
  timeRemaining: number
  sessionPhase: SessionPhase
  weather: string
  currentSpeed: SimSpeed
  tickerEntries: CommentaryEntry[]
}> = {}) {
  const onSetSpeed = vi.fn()
  const onPause = vi.fn()
  const onResume = vi.fn()
  render(
    <QualiBroadcastChrome
      segmentLabel={overrides.segmentLabel ?? 'Q1'}
      segmentName={overrides.segmentName ?? 'Qualifying 1'}
      timeRemaining={overrides.timeRemaining ?? 754}
      sessionPhase={overrides.sessionPhase ?? 'running'}
      weather={overrides.weather ?? 'dry'}
      currentSpeed={overrides.currentSpeed ?? 1}
      onSetSpeed={onSetSpeed}
      onPause={onPause}
      onResume={onResume}
      tickerEntries={overrides.tickerEntries ?? []}
    />,
  )
  return { onSetSpeed, onPause, onResume }
}

describe('QualiBroadcastChrome', () => {
  it('renders the segment label', () => {
    setup({ segmentLabel: 'Q1' })
    expect(screen.getByText('Q1')).toBeInTheDocument()
  })

  it('renders the time remaining as a formatted m:ss clock', () => {
    setup({ timeRemaining: 754 })
    // 754s → 12:34
    expect(screen.getByText('12:34')).toBeInTheDocument()
  })

  it('renders STANDBY status while idle', () => {
    setup({ sessionPhase: 'idle' })
    expect(screen.getByText('STANDBY')).toBeInTheDocument()
  })

  it('renders the LIVE status badge while running', () => {
    setup({ sessionPhase: 'running' })
    expect(screen.getByText('LIVE')).toBeInTheDocument()
  })

  it('renders the GRID SET status badge once finished', () => {
    setup({ sessionPhase: 'finished' })
    expect(screen.getByText('GRID SET')).toBeInTheDocument()
  })

  it('renders the weather uppercased', () => {
    setup({ weather: 'dry' })
    expect(screen.getByText('DRY')).toBeInTheDocument()
  })

  it('exposes the countdown clock as role="timer", not a per-tick live region', () => {
    setup({ timeRemaining: 754 })
    const timer = screen.getByRole('timer')
    expect(timer).toHaveTextContent('12:34')
    expect(timer).toHaveAttribute('aria-label', 'Session time remaining 12:34')
    // The countdown updates every reveal tick — it must NOT be a live region (that
    // would re-announce the clock many times/sec). Phase transitions are announced
    // separately via a dedicated sr-only role="status" node (asserted below).
    expect(timer).not.toHaveAttribute('aria-live')
  })

  it('announces phase transitions via a dedicated sr-only status region', () => {
    setup({ sessionPhase: 'finished' })
    expect(screen.getByRole('status')).toHaveTextContent('Qualifying complete, grid set')
  })
})
