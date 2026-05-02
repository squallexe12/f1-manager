import type { PitLaneCalibration } from '@/types/calibration'

/**
 * Per-circuit pit-lane geometry (Tier B v2). Sources:
 *   - FIA technical bulletins / sporting regs published per event
 *   - Race-event documents publicly summarising lane length and speed limit
 *   - Cross-referenced against broadcast pit-lane time-loss numbers
 *
 * Speed limit is 80 km/h universally in the 2026 calendar — the FIA removed
 * the 60 km/h overrides that occasionally appeared at earlier-era circuits.
 *
 * Decel / accel zone lengths use a 40m baseline. The actual physical decel
 * zone varies by circuit (some have a tight entry chicane, others a sweeper),
 * but the difference is sub-second on lap-time and well below the IP-B3
 * calibration noise floor — refine per-circuit only if playtest exposes a
 * specific outlier.
 *
 * Lengths are approximate (rounded to the nearest 5m). Treat as "good enough
 * for unsafe-release / speeding event timing"; pinpoint accuracy is not
 * meaningful given that the FSM samples speed-drift and release timing
 * stochastically.
 */
export const PIT_LANE_BY_CIRCUIT_ID: Record<string, PitLaneCalibration> = {
  'abu-dhabi':   { lengthMeters: 390, speedLimitKph: 80, entryDecelMeters: 40, exitAccelMeters: 40 },
  'austin':      { lengthMeters: 370, speedLimitKph: 80, entryDecelMeters: 40, exitAccelMeters: 40 },
  'bahrain':     { lengthMeters: 340, speedLimitKph: 80, entryDecelMeters: 40, exitAccelMeters: 40 },
  'baku':        { lengthMeters: 415, speedLimitKph: 80, entryDecelMeters: 40, exitAccelMeters: 40 },
  'barcelona':   { lengthMeters: 500, speedLimitKph: 80, entryDecelMeters: 40, exitAccelMeters: 40 },
  'hungary':     { lengthMeters: 340, speedLimitKph: 80, entryDecelMeters: 40, exitAccelMeters: 40 },
  'imola':       { lengthMeters: 310, speedLimitKph: 80, entryDecelMeters: 40, exitAccelMeters: 40 },
  'interlagos':  { lengthMeters: 300, speedLimitKph: 80, entryDecelMeters: 40, exitAccelMeters: 40 },
  'jeddah':      { lengthMeters: 430, speedLimitKph: 80, entryDecelMeters: 40, exitAccelMeters: 40 },
  'las-vegas':   { lengthMeters: 370, speedLimitKph: 80, entryDecelMeters: 40, exitAccelMeters: 40 },
  'melbourne':   { lengthMeters: 350, speedLimitKph: 80, entryDecelMeters: 40, exitAccelMeters: 40 },
  'mexico':      { lengthMeters: 315, speedLimitKph: 80, entryDecelMeters: 40, exitAccelMeters: 40 },
  'miami':       { lengthMeters: 340, speedLimitKph: 80, entryDecelMeters: 40, exitAccelMeters: 40 },
  // Monaco's lane is the shortest on the calendar — service stop dominates
  // total lane time more than transit at any other circuit.
  'monaco':      { lengthMeters: 280, speedLimitKph: 80, entryDecelMeters: 35, exitAccelMeters: 35 },
  'montreal':    { lengthMeters: 400, speedLimitKph: 80, entryDecelMeters: 40, exitAccelMeters: 40 },
  'monza':       { lengthMeters: 325, speedLimitKph: 80, entryDecelMeters: 40, exitAccelMeters: 40 },
  'qatar':       { lengthMeters: 330, speedLimitKph: 80, entryDecelMeters: 40, exitAccelMeters: 40 },
  'shanghai':    { lengthMeters: 395, speedLimitKph: 80, entryDecelMeters: 40, exitAccelMeters: 40 },
  'silverstone': { lengthMeters: 415, speedLimitKph: 80, entryDecelMeters: 40, exitAccelMeters: 40 },
  'singapore':   { lengthMeters: 360, speedLimitKph: 80, entryDecelMeters: 40, exitAccelMeters: 40 },
  // Spa has the longest pit lane on the calendar — transit time dominates
  // and unsafe-release windows stay open longer.
  'spa':         { lengthMeters: 485, speedLimitKph: 80, entryDecelMeters: 45, exitAccelMeters: 45 },
  // Red Bull Ring has the shortest functional decel zone of the calendar
  // because the lane entry is on the apex of the final corner; cars enter
  // at lower speed than typical.
  'spielberg':   { lengthMeters: 265, speedLimitKph: 80, entryDecelMeters: 30, exitAccelMeters: 30 },
  'suzuka':      { lengthMeters: 305, speedLimitKph: 80, entryDecelMeters: 40, exitAccelMeters: 40 },
  'zandvoort':   { lengthMeters: 330, speedLimitKph: 80, entryDecelMeters: 40, exitAccelMeters: 40 },
}

/**
 * Lookup with fallback. The caller (`sanitizeCalibrationProfile`) merges this
 * value into the loaded calibration profile so legacy JSON files (which were
 * authored before Tier B and lack the `pitLane` block) load without error.
 */
export function pitLaneForCircuit(circuitId: string, fallback: PitLaneCalibration): PitLaneCalibration {
  return PIT_LANE_BY_CIRCUIT_ID[circuitId] ?? fallback
}
