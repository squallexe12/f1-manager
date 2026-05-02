import type { RaceIncident } from '@/types/race'
import type { SanctionDeadline } from '@/types/pit-lane'

/**
 * Tier B v2 — drive-through / stop-go service-deadline state machine.
 *
 * When the penalty engine issues a drive-through or stop-go sanction, the
 * driver has `failureToServeWindowLaps` (default 3) to serve it. Failure to
 * do so converts to DNF with a `failure-to-serve` offence on the season
 * record. State is transient (lives in `raceRuntime`); never persisted.
 */

export interface FailureToServeState {
  sanctionDeadlines: Record<string, SanctionDeadline>
}

export function registerSanctionDeadline(
  state: FailureToServeState,
  driverId: string,
  sanction: 'drive-through' | 'stop-go',
  issuedOnLap: number,
  windowLaps: number,
): FailureToServeState {
  return {
    sanctionDeadlines: {
      ...state.sanctionDeadlines,
      [driverId]: {
        sanction,
        issuedOnLap,
        mustServeByLap: issuedOnLap + windowLaps,
      },
    },
  }
}

export function clearSanctionDeadline(
  state: FailureToServeState,
  driverId: string,
): FailureToServeState {
  if (!(driverId in state.sanctionDeadlines)) return state
  const next = { ...state.sanctionDeadlines }
  delete next[driverId]
  return { sanctionDeadlines: next }
}

export interface FailureToServeCheckResult {
  nextState: FailureToServeState
  incidents: RaceIncident[]
  dnfDriverIds: string[]
}

/**
 * Per-lap predicate. Called from the main race loop *before* the pit branch
 * runs. Any deadline whose `mustServeByLap` is strictly less than `currentLap`
 * has been missed → the driver is marked DNF and a `failure-to-serve` penalty
 * incident is emitted. Cleared deadlines are removed from the returned state.
 */
export function checkFailureToServe(
  state: FailureToServeState,
  currentLap: number,
): FailureToServeCheckResult {
  const incidents: RaceIncident[] = []
  const dnfDriverIds: string[] = []
  const remaining: Record<string, SanctionDeadline> = {}

  for (const [driverId, deadline] of Object.entries(state.sanctionDeadlines)) {
    if (currentLap > deadline.mustServeByLap) {
      incidents.push({
        lap: currentLap,
        type: 'penalty-issued',
        driverIds: [driverId],
        description: `${driverId.toUpperCase()} DNF — failed to serve ${deadline.sanction} within ${currentLap - deadline.issuedOnLap} laps`,
        investigationId: '',
        sanction: deadline.sanction,
        penaltyPointsIssued: 0,
        offenceType: 'failure-to-serve',
      })
      dnfDriverIds.push(driverId)
    } else {
      remaining[driverId] = deadline
    }
  }

  return {
    nextState: { sanctionDeadlines: remaining },
    incidents,
    dnfDriverIds,
  }
}
