import { describe, it, expect } from 'vitest'
import {
  registerSanctionDeadline,
  checkFailureToServe,
  clearSanctionDeadline,
  type FailureToServeState,
} from '@/engine/race/failure-to-serve'

function makeState(): FailureToServeState {
  return { sanctionDeadlines: {} }
}

describe('registerSanctionDeadline', () => {
  it('writes a deadline record keyed by driverId', () => {
    const state = makeState()
    const next = registerSanctionDeadline(state, 'd1', 'drive-through', 5, 3)
    expect(next.sanctionDeadlines['d1']).toEqual({
      sanction: 'drive-through',
      issuedOnLap: 5,
      mustServeByLap: 8,
    })
  })

  it('does not mutate the input state', () => {
    const state = makeState()
    registerSanctionDeadline(state, 'd1', 'drive-through', 5, 3)
    expect(state.sanctionDeadlines).toEqual({})
  })

  it('overwrites a prior deadline if registered again for the same driver', () => {
    const state: FailureToServeState = {
      sanctionDeadlines: {
        d1: { sanction: 'drive-through', issuedOnLap: 1, mustServeByLap: 4 },
      },
    }
    const next = registerSanctionDeadline(state, 'd1', 'stop-go', 7, 3)
    expect(next.sanctionDeadlines['d1']).toEqual({
      sanction: 'stop-go',
      issuedOnLap: 7,
      mustServeByLap: 10,
    })
  })
})

describe('checkFailureToServe', () => {
  it('returns no incidents when there are no deadlines', () => {
    const result = checkFailureToServe(makeState(), 5)
    expect(result.incidents).toEqual([])
    expect(result.dnfDriverIds).toEqual([])
  })

  it('returns no incidents when currentLap is at or below the deadline', () => {
    const state: FailureToServeState = {
      sanctionDeadlines: {
        d1: { sanction: 'drive-through', issuedOnLap: 5, mustServeByLap: 8 },
      },
    }
    const atBoundary = checkFailureToServe(state, 8)
    expect(atBoundary.incidents).toEqual([])
    expect(atBoundary.dnfDriverIds).toEqual([])
  })

  it('emits a penalty-issued incident with offenceType failure-to-serve when deadline is exceeded', () => {
    const state: FailureToServeState = {
      sanctionDeadlines: {
        d1: { sanction: 'drive-through', issuedOnLap: 5, mustServeByLap: 8 },
      },
    }
    const result = checkFailureToServe(state, 9)
    expect(result.incidents).toHaveLength(1)
    expect(result.incidents[0].type).toBe('penalty-issued')
    expect(result.incidents[0].driverIds).toEqual(['d1'])
    expect(result.dnfDriverIds).toEqual(['d1'])
    expect(result.nextState.sanctionDeadlines['d1']).toBeUndefined()
  })

  it('handles multiple drivers, partitioning expired vs still-pending', () => {
    const state: FailureToServeState = {
      sanctionDeadlines: {
        a: { sanction: 'drive-through', issuedOnLap: 1, mustServeByLap: 4 },
        b: { sanction: 'stop-go', issuedOnLap: 3, mustServeByLap: 6 },
        c: { sanction: 'drive-through', issuedOnLap: 4, mustServeByLap: 7 },
      },
    }
    const result = checkFailureToServe(state, 6)
    expect(result.dnfDriverIds.sort()).toEqual(['a'])
    expect(Object.keys(result.nextState.sanctionDeadlines).sort()).toEqual(['b', 'c'])
  })

  it('is idempotent: running again on the same lap with the cleared state returns no incidents', () => {
    const state: FailureToServeState = {
      sanctionDeadlines: {
        d1: { sanction: 'drive-through', issuedOnLap: 5, mustServeByLap: 8 },
      },
    }
    const first = checkFailureToServe(state, 9)
    const second = checkFailureToServe(first.nextState, 9)
    expect(second.incidents).toEqual([])
    expect(second.dnfDriverIds).toEqual([])
  })
})

describe('clearSanctionDeadline', () => {
  it('removes the entry for a single driver, leaving others intact', () => {
    const state: FailureToServeState = {
      sanctionDeadlines: {
        a: { sanction: 'drive-through', issuedOnLap: 1, mustServeByLap: 4 },
        b: { sanction: 'stop-go', issuedOnLap: 2, mustServeByLap: 5 },
      },
    }
    const next = clearSanctionDeadline(state, 'a')
    expect(Object.keys(next.sanctionDeadlines)).toEqual(['b'])
  })

  it('is a no-op when the driver has no deadline', () => {
    const state = makeState()
    expect(clearSanctionDeadline(state, 'ghost')).toEqual(state)
  })
})
