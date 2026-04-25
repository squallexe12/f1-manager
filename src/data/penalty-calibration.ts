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
  },
  banThreshold: 12,
  banDurationRounds: 1,
  warningThreshold: 5,
  warningGridDrop: 10,
  rollingWindowRounds: 22,
}
