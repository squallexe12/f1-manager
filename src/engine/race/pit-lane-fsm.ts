import type { PRNG } from '@/engine/core/prng'
import type { PitLaneCalibration } from '@/types/calibration'
import type { PitLaneCarState } from '@/types/pit-lane'

/**
 * Pure-function pit-lane FSM (Tier B v2). Cars advance through five zones
 * driven by `positionMeters` thresholds. Sub-step timing is supplied by the
 * caller (`simulatePitLane` in `pit-lane-engine.ts`) — this module is a
 * single-tick advancer, deterministic given the same inputs and PRNG state.
 *
 * Zone semantics:
 *   pre-entry  → not yet started; tick is a no-op (sentinel)
 *   entry-decel→ linear decel from carEntrySpeedKph → speedLimitKph over entryDecelMeters
 *   limit-zone → service window (position frozen, speed 0) then transit at speedLimit + drift
 *   exit-accel → linear accel from speedLimitKph → carExitSpeedKph over exitAccelMeters
 *   exited     → past lane-exit line; tick is a no-op
 */

export interface PitLaneFsmContext {
  pitLane: PitLaneCalibration
  /** Race-line speed at which the car crossed the lane-entry line. ~200-250 km/h typical. */
  carEntrySpeedKph: number
  /** Target race-line speed at lane-exit. Symmetric with entry; varies by circuit. */
  carExitSpeedKph: number
  /** Time the car will spend stationary at the box — pre-computed from serviceTime rating + scatter. */
  serviceDurationSeconds: number
  /** 0–100 attribute. Modulates speed-drift distribution upstream of this function via the sample callback. */
  speedDiscipline: number
}

export function transitMeters(pitLane: PitLaneCalibration): number {
  return Math.max(0, pitLane.lengthMeters - pitLane.entryDecelMeters - pitLane.exitAccelMeters)
}

/**
 * Advance one car's FSM by `deltaSeconds`. Returns a new `PitLaneCarState`
 * — pure: never mutates input.
 *
 * The `sampleLimitDriftKph` callback is the FSM's only stochastic input.
 * Caller controls PRNG ordering by deciding when to invoke this function.
 * Inside the limit-zone (post-service), the callback fires once per tick
 * to draw the speed-drift sample for that tick.
 */
export function tickPitLaneFsm(
  state: PitLaneCarState,
  deltaSeconds: number,
  currentSubStepTime: number,
  ctx: PitLaneFsmContext,
  sampleLimitDriftKph: (rng: PRNG) => number,
  rng: PRNG,
): PitLaneCarState {
  const next: PitLaneCarState = { ...state }

  if (state.zone === 'pre-entry' || state.zone === 'exited') {
    return next
  }

  const limit = ctx.pitLane.speedLimitKph
  const decelEnd = ctx.pitLane.entryDecelMeters
  const limitZoneEnd = decelEnd + transitMeters(ctx.pitLane)
  const lengthMeters = ctx.pitLane.lengthMeters

  if (state.zone === 'entry-decel') {
    const t = decelEnd === 0 ? 1 : Math.min(1, state.positionMeters / decelEnd)
    const speed = ctx.carEntrySpeedKph + (limit - ctx.carEntrySpeedKph) * t
    next.speedKph = speed
    next.positionMeters = state.positionMeters + (speed / 3.6) * deltaSeconds
    if (next.positionMeters >= decelEnd) {
      next.positionMeters = decelEnd
      next.zone = 'limit-zone'
      next.zoneEnteredAtSeconds = currentSubStepTime
      next.serviceStartSeconds = currentSubStepTime
      next.serviceEndSeconds = currentSubStepTime + ctx.serviceDurationSeconds
      next.speedKph = 0
    }
    return next
  }

  if (state.zone === 'limit-zone') {
    if (state.serviceEndSeconds !== null && currentSubStepTime < state.serviceEndSeconds) {
      next.speedKph = 0
      return next
    }
    if (state.releasedAtSeconds === null && state.serviceEndSeconds !== null) {
      next.releasedAtSeconds = state.serviceEndSeconds
    }
    const drift = sampleLimitDriftKph(rng)
    const sampledSpeed = Math.max(0, limit + drift)
    next.speedKph = sampledSpeed
    next.positionMeters = state.positionMeters + (sampledSpeed / 3.6) * deltaSeconds
    if (next.positionMeters >= limitZoneEnd) {
      next.positionMeters = limitZoneEnd
      next.zone = 'exit-accel'
      next.zoneEnteredAtSeconds = currentSubStepTime
    }
    return next
  }

  if (state.zone === 'exit-accel') {
    const accelStart = limitZoneEnd
    const accelLen = ctx.pitLane.exitAccelMeters
    const t = accelLen === 0 ? 1 : Math.min(1, (state.positionMeters - accelStart) / accelLen)
    const speed = limit + (ctx.carExitSpeedKph - limit) * t
    next.speedKph = speed
    next.positionMeters = state.positionMeters + (speed / 3.6) * deltaSeconds
    if (next.positionMeters >= lengthMeters) {
      next.positionMeters = lengthMeters
      next.zone = 'exited'
    }
    return next
  }

  return next
}
