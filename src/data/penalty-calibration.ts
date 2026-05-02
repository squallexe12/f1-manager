import type { OffenceType, SanctionType, SeverityTier } from '@/types/race'

export interface PenaltyCalibration {
  faultThreshold: number
  severityBands: { minor: number; serious: number; major: number; egregious: number }
  investigationWindow: { minLaps: number; maxLaps: number }
  sanctionMatrix: Record<OffenceType, Record<SeverityTier, {
    sanction: SanctionType
    timePenaltySeconds: number
    penaltyPoints: number
    warningCounted: boolean
  }>>
  banThreshold: number
  banDurationRounds: number
  warningThreshold: number
  warningGridDrop: number
  rollingWindowRounds: number
  /** Tier B: minimum fault score for an unsafe-release decision to fire. */
  unsafeReleaseFaultThreshold: number
  /** Tier B: speed-sample mean offset (km/h) below the limit at neutral discipline. */
  pitLaneSpeedingMeanOffsetKph: number
  /** Tier B: max laps after issue to serve drive-through / stop-go before DNF. */
  failureToServeWindowLaps: number
}

export const DEFAULT_PENALTY_CALIBRATION: PenaltyCalibration = {
  faultThreshold: 0.45,
  severityBands: { minor: 0.10, serious: 0.25, major: 0.40, egregious: 1.00 },
  investigationWindow: { minLaps: 1, maxLaps: 5 },
  sanctionMatrix: {
    'collision-minor': {
      minor:     { sanction: '5s',  timePenaltySeconds: 5,  penaltyPoints: 1, warningCounted: true },
      serious:   { sanction: '5s',  timePenaltySeconds: 5,  penaltyPoints: 2, warningCounted: true },
      major:     { sanction: '10s', timePenaltySeconds: 10, penaltyPoints: 2, warningCounted: true },
      egregious: { sanction: '10s', timePenaltySeconds: 10, penaltyPoints: 3, warningCounted: true },
    },
    'collision-serious': {
      minor:     { sanction: '10s',           timePenaltySeconds: 10, penaltyPoints: 2, warningCounted: true },
      serious:   { sanction: 'drive-through', timePenaltySeconds: 20, penaltyPoints: 3, warningCounted: true },
      major:     { sanction: 'drive-through', timePenaltySeconds: 20, penaltyPoints: 3, warningCounted: true },
      egregious: { sanction: 'stop-go',       timePenaltySeconds: 28, penaltyPoints: 4, warningCounted: true },
    },
    'forcing-off': {
      minor:     { sanction: '5s',  timePenaltySeconds: 5,  penaltyPoints: 1, warningCounted: true },
      serious:   { sanction: '5s',  timePenaltySeconds: 5,  penaltyPoints: 1, warningCounted: true },
      major:     { sanction: '10s', timePenaltySeconds: 10, penaltyPoints: 2, warningCounted: true },
      egregious: { sanction: '10s', timePenaltySeconds: 10, penaltyPoints: 2, warningCounted: true },
    },
    'illegal-defending': {
      minor:     { sanction: 'reprimand', timePenaltySeconds: 0,  penaltyPoints: 0, warningCounted: true },
      serious:   { sanction: '5s',        timePenaltySeconds: 5,  penaltyPoints: 1, warningCounted: true },
      major:     { sanction: '5s',        timePenaltySeconds: 5,  penaltyPoints: 1, warningCounted: true },
      egregious: { sanction: '10s',       timePenaltySeconds: 10, penaltyPoints: 2, warningCounted: true },
    },
    // Tier B — pit-stop-adjacent offences.
    // Unsafe release: blamed on the released-car driver per FIA convention.
    // Time penalty grows with severity; pp scales with how short the gap was.
    'unsafe-release': {
      minor:     { sanction: '5s',            timePenaltySeconds: 5,  penaltyPoints: 1, warningCounted: true },
      serious:   { sanction: '10s',           timePenaltySeconds: 10, penaltyPoints: 2, warningCounted: true },
      major:     { sanction: 'drive-through', timePenaltySeconds: 20, penaltyPoints: 3, warningCounted: true },
      egregious: { sanction: 'drive-through', timePenaltySeconds: 20, penaltyPoints: 3, warningCounted: true },
    },
    // Pit-lane speeding: real F1 issues drive-through almost universally,
    // regardless of how far over the limit. No penalty points (procedural).
    'pit-lane-speeding': {
      minor:     { sanction: 'drive-through', timePenaltySeconds: 20, penaltyPoints: 0, warningCounted: false },
      serious:   { sanction: 'drive-through', timePenaltySeconds: 20, penaltyPoints: 0, warningCounted: false },
      major:     { sanction: 'drive-through', timePenaltySeconds: 20, penaltyPoints: 0, warningCounted: false },
      egregious: { sanction: 'drive-through', timePenaltySeconds: 20, penaltyPoints: 0, warningCounted: false },
    },
    // Failure-to-serve: matrix entry exists for type-completeness, but the
    // real consequence is DNF — the simulator marks the driver and records
    // a 0s entry on the season-stats penalty count. The stop-go sanction is
    // notional; real F1 already pulled the car for not serving.
    'failure-to-serve': {
      minor:     { sanction: 'stop-go', timePenaltySeconds: 0, penaltyPoints: 0, warningCounted: false },
      serious:   { sanction: 'stop-go', timePenaltySeconds: 0, penaltyPoints: 0, warningCounted: false },
      major:     { sanction: 'stop-go', timePenaltySeconds: 0, penaltyPoints: 0, warningCounted: false },
      egregious: { sanction: 'stop-go', timePenaltySeconds: 0, penaltyPoints: 0, warningCounted: false },
    },
  },
  banThreshold: 12,
  banDurationRounds: 1,
  warningThreshold: 5,
  warningGridDrop: 10,
  rollingWindowRounds: 22,
  unsafeReleaseFaultThreshold: 0.45,
  pitLaneSpeedingMeanOffsetKph: -1,
  failureToServeWindowLaps: 3,
}
