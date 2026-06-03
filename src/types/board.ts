export type BoardObjectiveKind = 'constructorFinish' | 'pointsTarget' | 'beatRival'

export interface BoardObjective {
  kind: BoardObjectiveKind
  label: string
  target: number       // constructorFinish: position; pointsTarget: points; beatRival: unused (pass 1 by convention)
  weight: number       // 0.5 | 0.3 | 0.2
  current: number      // live value
  met: boolean         // absolute achievement (display each race; authoritative at season end)
}

export interface BoardExpectations {
  objectives: BoardObjective[]
  rivalTeamId: string
  confidence: number              // 0-100 live meter
  confidenceHistory: number[]     // FIFO-capped, sparkline
  warningsIssued: number          // carried across seasons (escalation memory)
  tenureStatus: 'active' | 'warned' | 'sacked'
  verdict: 'retain' | 'warning' | 'sack' | null  // last season-end verdict
  lastProcessedRound: number      // idempotency guard
}
