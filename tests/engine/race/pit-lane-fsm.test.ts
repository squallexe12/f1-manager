import { describe, it, expect } from 'vitest'
import {
  tickPitLaneFsm,
  transitMeters,
  type PitLaneFsmContext,
} from '@/engine/race/pit-lane-fsm'
import { createPRNG } from '@/engine/core/prng'
import type { PitLaneCarState } from '@/types/pit-lane'
import type { PitLaneCalibration } from '@/types/calibration'

const STD_LANE: PitLaneCalibration = {
  lengthMeters: 350,
  speedLimitKph: 80,
  entryDecelMeters: 40,
  exitAccelMeters: 40,
}

function makeCtx(overrides: Partial<PitLaneFsmContext> = {}): PitLaneFsmContext {
  return {
    pitLane: STD_LANE,
    carEntrySpeedKph: 240,
    carExitSpeedKph: 240,
    serviceDurationSeconds: 2.5,
    speedDiscipline: 70,
    ...overrides,
  }
}

function makeCar(zone: PitLaneCarState['zone'], overrides: Partial<PitLaneCarState> = {}): PitLaneCarState {
  return {
    driverId: 'd1',
    zone,
    enteredAtSeconds: 0,
    zoneEnteredAtSeconds: 0,
    speedKph: 240,
    positionMeters: 0,
    serviceStartSeconds: null,
    serviceEndSeconds: null,
    releasedAtSeconds: null,
    ...overrides,
  }
}

describe('transitMeters', () => {
  it('returns lengthMeters - entryDecelMeters - exitAccelMeters', () => {
    expect(transitMeters(STD_LANE)).toBe(270)
  })
})

describe('tickPitLaneFsm — entry-decel zone', () => {
  it('decelerates linearly from carEntrySpeed to speedLimit across the decel zone', () => {
    const ctx = makeCtx()
    const rng = createPRNG(1)
    const sample = () => 0
    let car = makeCar('entry-decel', { speedKph: 240 })
    // Advance tiny ticks; at position 0, speed should equal carEntrySpeedKph
    car = tickPitLaneFsm(car, 0.01, 0, ctx, sample, rng)
    // Speed near top of decel zone is between speedLimit and carEntrySpeed
    expect(car.speedKph).toBeGreaterThan(ctx.pitLane.speedLimitKph)
    expect(car.speedKph).toBeLessThanOrEqual(ctx.carEntrySpeedKph)
    expect(car.positionMeters).toBeGreaterThan(0)
  })

  it('transitions to limit-zone exactly at entryDecelMeters with service started', () => {
    const ctx = makeCtx({ serviceDurationSeconds: 3 })
    const rng = createPRNG(1)
    const sample = () => 0
    // Place car right at the threshold; one more tick crosses it
    let car = makeCar('entry-decel', { positionMeters: 39, speedKph: 80 })
    car = tickPitLaneFsm(car, 0.5, 1.5, ctx, sample, rng)
    expect(car.zone).toBe('limit-zone')
    expect(car.positionMeters).toBe(40)  // clamped to entryDecelMeters
    expect(car.serviceStartSeconds).toBe(1.5)
    expect(car.serviceEndSeconds).toBe(4.5)  // 1.5 + 3
    expect(car.speedKph).toBe(0)  // car stationary at box
  })
})

describe('tickPitLaneFsm — limit-zone (service window)', () => {
  it('keeps position frozen and speed at zero while currentSubStepTime < serviceEndSeconds', () => {
    const ctx = makeCtx({ serviceDurationSeconds: 2 })
    const rng = createPRNG(1)
    const sample = () => 0
    let car = makeCar('limit-zone', {
      positionMeters: 40,
      speedKph: 0,
      serviceStartSeconds: 0,
      serviceEndSeconds: 2,
    })
    car = tickPitLaneFsm(car, 0.5, 0.5, ctx, sample, rng)  // t=0.5, mid-service
    expect(car.positionMeters).toBe(40)
    expect(car.speedKph).toBe(0)
    expect(car.releasedAtSeconds).toBeNull()
  })

  it('sets releasedAtSeconds = serviceEndSeconds on the first tick after service completes', () => {
    const ctx = makeCtx()
    const rng = createPRNG(1)
    const sample = () => 0
    let car = makeCar('limit-zone', {
      positionMeters: 40,
      speedKph: 0,
      serviceStartSeconds: 0,
      serviceEndSeconds: 2,
    })
    car = tickPitLaneFsm(car, 0.1, 2.1, ctx, sample, rng)  // t=2.1, past service
    expect(car.releasedAtSeconds).toBe(2)
    expect(car.speedKph).toBeCloseTo(80, 1)  // at limit
  })
})

describe('tickPitLaneFsm — limit-zone (transit)', () => {
  it('advances position at speedLimit + drift after release', () => {
    const ctx = makeCtx()
    const rng = createPRNG(1)
    const sample = () => 0  // zero drift
    let car = makeCar('limit-zone', {
      positionMeters: 40,
      speedKph: 0,
      serviceStartSeconds: 0,
      serviceEndSeconds: 2,
      releasedAtSeconds: 2,
    })
    car = tickPitLaneFsm(car, 1.0, 3.0, ctx, sample, rng)
    expect(car.speedKph).toBeCloseTo(80, 1)
    // 80 km/h = 22.22 m/s × 1s = 22.22m of advance
    expect(car.positionMeters).toBeCloseTo(40 + 80 / 3.6, 1)
  })

  it('transitions to exit-accel at end of limit-zone', () => {
    const ctx = makeCtx()
    const rng = createPRNG(1)
    const sample = () => 0
    const limitExit = 40 + transitMeters(STD_LANE)  // 310
    let car = makeCar('limit-zone', {
      positionMeters: limitExit - 1,
      speedKph: 80,
      serviceStartSeconds: 0,
      serviceEndSeconds: 2,
      releasedAtSeconds: 2,
    })
    car = tickPitLaneFsm(car, 0.5, 5, ctx, sample, rng)
    expect(car.zone).toBe('exit-accel')
    expect(car.positionMeters).toBe(limitExit)
  })

  it('honours the speed-drift sample (sample function controls speed)', () => {
    const ctx = makeCtx()
    const rng = createPRNG(1)
    const sample = () => 5  // +5 km/h drift = speeding territory
    let car = makeCar('limit-zone', {
      positionMeters: 40,
      speedKph: 0,
      serviceStartSeconds: 0,
      serviceEndSeconds: 2,
      releasedAtSeconds: 2,
    })
    car = tickPitLaneFsm(car, 0.1, 2.5, ctx, sample, rng)
    expect(car.speedKph).toBeCloseTo(85, 1)
  })
})

describe('tickPitLaneFsm — exit-accel zone', () => {
  it('accelerates linearly from speedLimit to carExitSpeed across the accel zone', () => {
    const ctx = makeCtx({ carExitSpeedKph: 240 })
    const rng = createPRNG(1)
    const sample = () => 0
    const accelStart = 40 + transitMeters(STD_LANE)  // 310
    let car = makeCar('exit-accel', {
      positionMeters: accelStart,
      speedKph: 80,
    })
    car = tickPitLaneFsm(car, 0.1, 6, ctx, sample, rng)
    expect(car.speedKph).toBeGreaterThanOrEqual(ctx.pitLane.speedLimitKph)
    expect(car.speedKph).toBeLessThanOrEqual(ctx.carExitSpeedKph)
  })

  it('transitions to exited at lengthMeters', () => {
    const ctx = makeCtx()
    const rng = createPRNG(1)
    const sample = () => 0
    let car = makeCar('exit-accel', {
      positionMeters: STD_LANE.lengthMeters - 1,
      speedKph: 200,
    })
    car = tickPitLaneFsm(car, 1.0, 7, ctx, sample, rng)
    expect(car.zone).toBe('exited')
    expect(car.positionMeters).toBe(STD_LANE.lengthMeters)
  })
})

describe('tickPitLaneFsm — sentinels', () => {
  it('returns state unchanged when zone is pre-entry', () => {
    const ctx = makeCtx()
    const rng = createPRNG(1)
    const sample = () => 0
    const car = makeCar('pre-entry')
    const next = tickPitLaneFsm(car, 1, 0, ctx, sample, rng)
    expect(next).toEqual(car)
  })

  it('returns state unchanged when zone is exited', () => {
    const ctx = makeCtx()
    const rng = createPRNG(1)
    const sample = () => 0
    const car = makeCar('exited', { positionMeters: 350 })
    const next = tickPitLaneFsm(car, 1, 10, ctx, sample, rng)
    expect(next).toEqual(car)
  })
})
