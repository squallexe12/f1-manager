import { describe, it, expect } from 'vitest'
import { PIT_LANE_BY_CIRCUIT_ID, pitLaneForCircuit } from '@/data/pit-lane-circuits'
import { DEFAULT_PITLANE_CALIBRATION } from '@/types/calibration'

const CALENDAR_2026_CIRCUIT_IDS = [
  'abu-dhabi', 'austin', 'bahrain', 'baku', 'barcelona', 'hungary', 'imola',
  'interlagos', 'jeddah', 'las-vegas', 'melbourne', 'mexico', 'miami', 'monaco',
  'montreal', 'monza', 'qatar', 'shanghai', 'silverstone', 'singapore', 'spa',
  'spielberg', 'suzuka', 'zandvoort',
]

describe('PIT_LANE_BY_CIRCUIT_ID', () => {
  it('covers every 2026 calendar circuit', () => {
    for (const id of CALENDAR_2026_CIRCUIT_IDS) {
      expect(PIT_LANE_BY_CIRCUIT_ID[id], `missing pit-lane data for ${id}`).toBeDefined()
    }
  })

  it('every entry has a plausible length (200m–600m)', () => {
    for (const [id, entry] of Object.entries(PIT_LANE_BY_CIRCUIT_ID)) {
      expect(entry.lengthMeters, `${id} length out of range`).toBeGreaterThanOrEqual(200)
      expect(entry.lengthMeters, `${id} length out of range`).toBeLessThanOrEqual(600)
    }
  })

  it('every entry uses 80 km/h speed limit (2026 universal)', () => {
    for (const [id, entry] of Object.entries(PIT_LANE_BY_CIRCUIT_ID)) {
      expect(entry.speedLimitKph, `${id} speed limit not 80`).toBe(80)
    }
  })

  it('decel + accel zones never exceed total length', () => {
    for (const [id, entry] of Object.entries(PIT_LANE_BY_CIRCUIT_ID)) {
      expect(
        entry.entryDecelMeters + entry.exitAccelMeters,
        `${id} decel+accel exceeds length`,
      ).toBeLessThan(entry.lengthMeters)
    }
  })
})

describe('pitLaneForCircuit', () => {
  it('returns the table entry when known', () => {
    expect(pitLaneForCircuit('monaco', DEFAULT_PITLANE_CALIBRATION)).toEqual(
      PIT_LANE_BY_CIRCUIT_ID['monaco'],
    )
  })

  it('returns the fallback when the circuit id is unknown', () => {
    expect(pitLaneForCircuit('atlantis', DEFAULT_PITLANE_CALIBRATION)).toEqual(
      DEFAULT_PITLANE_CALIBRATION,
    )
  })
})
