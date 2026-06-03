import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BoardVerdictPanel } from '@/components/season-end/board-verdict-panel'

const base = {
  outcomeScore: 30, warningsIssued: 1, rivalTeamId: 'ferrari',
  objectives: [
    { kind: 'constructorFinish' as const, label: 'Finish P3', target: 3, weight: 0.5, current: 7, met: false },
  ],
}

describe('BoardVerdictPanel', () => {
  it('shows the sacked screen with a Start New Career action', () => {
    render(<BoardVerdictPanel verdict={{ ...base, verdict: 'sack', tenureStatus: 'sacked' }} onNewCareer={() => {}} />)
    expect(screen.getByText(/sacked/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start new career/i })).toBeInTheDocument()
  })
  it('shows a warning when retained-under-warning', () => {
    render(<BoardVerdictPanel verdict={{ ...base, verdict: 'warning', tenureStatus: 'warned' }} onNewCareer={() => {}} />)
    expect(screen.getByText(/final warning/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /start new career/i })).toBeNull()
  })
})
