import { describe, it, expect } from 'vitest'
import { DEFAULT_PENALTY_CALIBRATION } from '@/data/penalty-calibration'

describe('DEFAULT_PENALTY_CALIBRATION', () => {
  it('threshold and severity bands are monotonically increasing', () => {
    const c = DEFAULT_PENALTY_CALIBRATION
    expect(c.faultThreshold).toBeGreaterThan(0)
    expect(c.faultThreshold).toBeLessThan(1)
    expect(c.severityBands.minor).toBeLessThan(c.severityBands.serious)
    expect(c.severityBands.serious).toBeLessThan(c.severityBands.major)
    expect(c.severityBands.major).toBeLessThan(c.severityBands.egregious)
  })

  it('investigation window is non-empty and non-negative', () => {
    const w = DEFAULT_PENALTY_CALIBRATION.investigationWindow
    expect(w.minLaps).toBeGreaterThan(0)
    expect(w.maxLaps).toBeGreaterThanOrEqual(w.minLaps)
  })

  it('every (offenceType, severity) combination has a sanction matrix entry', () => {
    const offences = ['collision-minor', 'collision-serious', 'forcing-off', 'illegal-defending'] as const
    const severities = ['minor', 'serious', 'major', 'egregious'] as const
    for (const o of offences) {
      for (const s of severities) {
        const cell = DEFAULT_PENALTY_CALIBRATION.sanctionMatrix[o][s]
        expect(cell).toBeDefined()
        expect(cell.timePenaltySeconds).toBeGreaterThanOrEqual(0)
        expect(cell.penaltyPoints).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('thresholds match real F1: 12 points → ban, 5 warnings → 10-place drop, 22-round window', () => {
    const c = DEFAULT_PENALTY_CALIBRATION
    expect(c.banThreshold).toBe(12)
    expect(c.banDurationRounds).toBe(1)
    expect(c.warningThreshold).toBe(5)
    expect(c.warningGridDrop).toBe(10)
    expect(c.rollingWindowRounds).toBe(22)
  })
})
