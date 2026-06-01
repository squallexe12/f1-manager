import { describe, it, expect } from 'vitest'
import type { LapResult, AppliedPenalty } from '@/types/race'
import { finalResultsToRaceResults } from '@/app/strategy/page'

// Pure mapper extracted from the strategy page's onRaceEnd. Verifies the
// authoritative `retired` flag drives `dnf`, that a retired driver never keeps
// the fastest-lap flag, and that applied penalties are threaded through.

function lapResult(over: Partial<LapResult> = {}): LapResult {
  return {
    lap: 50,
    driverId: 'd1',
    lapTime: 90,
    sector1: 30,
    sector2: 30,
    sector3: 30,
    position: 1,
    gapToLeader: 0,
    gapToAhead: 0,
    tire: { compound: 'C3', label: 'medium', wear: 0.4, lapsFitted: 10 },
    pitted: false,
    retired: false,
    ...over,
  }
}

describe('finalResultsToRaceResults', () => {
  it('maps retired rows to dnf:true and running rows to dnf:false', () => {
    const finalResults: LapResult[] = [
      lapResult({ driverId: 'd1', position: 1, retired: false }),
      lapResult({ driverId: 'd2', position: 2, retired: true, lapTime: 0 }),
    ]
    const out = finalResultsToRaceResults(
      finalResults,
      { driverId: 'd1', time: 88 },
      {},
    )
    expect(out).toEqual([
      { driverId: 'd1', position: 1, dnf: false, fastestLap: true, appliedPenalties: [] },
      { driverId: 'd2', position: 2, dnf: true, fastestLap: false, appliedPenalties: [] },
    ])
  })

  it('never grants fastestLap to a retired driver even if the id matches', () => {
    const finalResults: LapResult[] = [
      lapResult({ driverId: 'd3', position: 5, retired: true, lapTime: 0 }),
    ]
    const out = finalResultsToRaceResults(
      finalResults,
      { driverId: 'd3', time: 87 },
      {},
    )
    expect(out[0].dnf).toBe(true)
    expect(out[0].fastestLap).toBe(false)
  })

  it('threads applied penalties through per driver', () => {
    const penalties: AppliedPenalty[] = [
      {
        offenceType: 'track-limits',
        sanction: { kind: 'time', seconds: 5 },
        lap: 12,
        reason: 'exceeded track limits',
      } as unknown as AppliedPenalty,
    ]
    const finalResults: LapResult[] = [lapResult({ driverId: 'd1', position: 1 })]
    const out = finalResultsToRaceResults(
      finalResults,
      { driverId: '', time: Infinity },
      { d1: penalties },
    )
    expect(out[0].appliedPenalties).toBe(penalties)
  })
})
