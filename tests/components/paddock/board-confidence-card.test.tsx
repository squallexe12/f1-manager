import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BoardConfidenceCard } from '@/components/paddock/board-confidence-card'
import type { BoardExpectations } from '@/types/board'

const board: BoardExpectations = {
  objectives: [
    { kind: 'constructorFinish', label: "Finish P5 in the Constructors'", target: 5, weight: 0.5, current: 4, met: true },
    { kind: 'pointsTarget', label: 'Score 220 points', target: 220, weight: 0.3, current: 110, met: false },
    { kind: 'beatRival', label: 'Finish ahead of Ferrari', target: 1, weight: 0.2, current: 1, met: true },
  ],
  rivalTeamId: 'ferrari',
  confidence: 72,
  confidenceHistory: [60, 72],
  warningsIssued: 0,
  tenureStatus: 'active',
  verdict: null,
  lastProcessedRound: 3,
}

describe('BoardConfidenceCard', () => {
  it('renders confidence, band, and the objective list', () => {
    render(<BoardConfidenceCard board={board} />)
    expect(screen.getByText('72')).toBeInTheDocument()
    expect(screen.getByText('SECURE')).toBeInTheDocument()
    expect(screen.getByText("Finish P5 in the Constructors'")).toBeInTheDocument()
    expect(screen.getByText('Finish ahead of Ferrari')).toBeInTheDocument()
  })

  it('shows the UNDER PRESSURE band in the mid range with a down trend', () => {
    render(<BoardConfidenceCard board={{ ...board, confidence: 45, confidenceHistory: [50, 45] }} />)
    expect(screen.getByText('UNDER PRESSURE')).toBeInTheDocument()
    expect(screen.getByLabelText(/trending down/)).toBeInTheDocument()
  })

  it('shows the ON THE BRINK band below 30', () => {
    render(<BoardConfidenceCard board={{ ...board, confidence: 20, confidenceHistory: [25, 20] }} />)
    expect(screen.getByText('ON THE BRINK')).toBeInTheDocument()
  })
})
