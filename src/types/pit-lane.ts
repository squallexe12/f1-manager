/**
 * Tier B v2 — pit-lane finite-state machine types.
 *
 * Sub-step time model lives entirely inside the pit branch of the race
 * simulator (lazy sub-stepping per spec §4.2). All state here is transient
 * and never persisted; it lives inside `SimRaceState` only for the laps in
 * which ≥1 car occupies the pit lane.
 */

export type PitLaneZone =
  | 'pre-entry'      // not yet entered the lane
  | 'entry-decel'    // crossed lane-entry line, decelerating to limit
  | 'limit-zone'     // at speed limit, transit + service overlap here
  | 'exit-accel'     // released, accelerating back to race speed
  | 'exited'         // crossed lane-exit line, back on the racing surface

/**
 * Per-driver pit-lane runtime state for a single sub-step simulation.
 * Mutable within a `simulatePitLane` call; freshly constructed at lane
 * entry and discarded once the driver reaches `'exited'`.
 */
export interface PitLaneCarState {
  driverId: string
  zone: PitLaneZone
  /** Sub-step `t = 0` is lap-start. This is the moment the car crossed lane-entry. */
  enteredAtSeconds: number
  /** When the current zone began. Resets on each transition. */
  zoneEnteredAtSeconds: number
  /** Current sampled speed, km/h. Re-sampled each sub-step tick inside `limit-zone`. */
  speedKph: number
  /** Distance travelled since lane-entry, meters. 0 → lengthMeters across the FSM. */
  positionMeters: number
  /** When mechanic service began (car at the box). Null until reached. */
  serviceStartSeconds: number | null
  /** When mechanic service ended. Equals `serviceStartSeconds + serviceDurationSeconds`. */
  serviceEndSeconds: number | null
  /** When the lollipop / release supervisor green-lit the car. Null until released. */
  releasedAtSeconds: number | null
}

/**
 * Open sanction tracker. Drive-through and stop-go penalties must be served
 * within `failureToServeWindowLaps` of issue or the driver DNFs with a
 * `failure-to-serve` offence on record.
 */
export interface SanctionDeadline {
  sanction: 'drive-through' | 'stop-go'
  issuedOnLap: number
  mustServeByLap: number
}
