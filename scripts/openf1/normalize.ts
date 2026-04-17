import type { TireCompound, WeatherState } from '../../src/types/race'
import {
  DEFAULT_TIRE_CALIBRATION,
  DEFAULT_WEATHER_CALIBRATION,
  DEFAULT_OVERTAKE_CALIBRATION,
  type TireCalibration,
  type WeatherCalibration,
  type OvertakeCalibration,
  type CalibrationProfile,
} from '../../src/types/calibration'
import type {
  OpenF1Lap,
  OpenF1Stint,
  OpenF1Weather,
  OpenF1CompoundLabel,
  OpenF1SessionBundle,
} from './types'

// ---------------------------------------------------------------------------
// Compound mapping — OpenF1 uses SOFT/MEDIUM/HARD relative to a race's Pirelli
// pick. The circuit's compound triplet (e.g. ['C1','C2','C3']) resolves these
// relative labels to absolute Pirelli C1–C5 compounds.
// ---------------------------------------------------------------------------

export function mapOpenF1CompoundToPirelli(
  label: OpenF1CompoundLabel,
  circuitCompounds: TireCompound[],
): TireCompound | null {
  if (circuitCompounds.length !== 3) return null
  // circuitCompounds are stored hardest-to-softest (e.g. C1, C2, C3).
  const [hard, medium, soft] = circuitCompounds
  switch (label) {
    case 'HARD':
      return hard
    case 'MEDIUM':
      return medium
    case 'SOFT':
      return soft
    case 'INTERMEDIATE':
    case 'WET':
      return null
  }
}

// ---------------------------------------------------------------------------
// Weather normalizer
// ---------------------------------------------------------------------------

export function normalizeWeatherCalibration(samples: OpenF1Weather[]): WeatherCalibration {
  if (samples.length === 0) {
    return {
      transitionProbabilities: { ...DEFAULT_WEATHER_CALIBRATION.transitionProbabilities },
      baseRainProbability: DEFAULT_WEATHER_CALIBRATION.baseRainProbability,
      temperatureRange: { ...DEFAULT_WEATHER_CALIBRATION.temperatureRange },
    }
  }

  let minTemp = Number.POSITIVE_INFINITY
  let maxTemp = Number.NEGATIVE_INFINITY
  let wetCount = 0

  for (const sample of samples) {
    if (sample.air_temperature < minTemp) minTemp = sample.air_temperature
    if (sample.air_temperature > maxTemp) maxTemp = sample.air_temperature
    if (sample.rainfall > 0) wetCount++
  }

  const baseRainProbability = clamp01(wetCount / samples.length)

  // Transition probabilities: blend observed rain frequency with defaults.
  // If rainfall is consistently absent the dry→damp transition stays low;
  // if rainfall is present, all transition probs scale up proportionally.
  const rainFactor = baseRainProbability
  const transitionProbabilities: Record<WeatherState, number> = {
    dry: DEFAULT_WEATHER_CALIBRATION.transitionProbabilities.dry + rainFactor * 0.02,
    damp: DEFAULT_WEATHER_CALIBRATION.transitionProbabilities.damp,
    wet: DEFAULT_WEATHER_CALIBRATION.transitionProbabilities.wet,
  }

  return {
    transitionProbabilities,
    baseRainProbability,
    temperatureRange: { min: minTemp, max: maxTemp },
  }
}

// ---------------------------------------------------------------------------
// Tire normalizer — computes per-compound degradation and grip from observed
// stint/lap data. Compounds not observed retain default values.
// ---------------------------------------------------------------------------

interface CompoundSamples {
  // Each pair: (stint lap age, lap duration seconds)
  readings: Array<{ age: number; duration: number }>
}

export function normalizeTireCalibration(
  laps: OpenF1Lap[],
  stints: OpenF1Stint[],
  circuitCompounds: TireCompound[],
): TireCalibration {
  const base: TireCalibration = {
    degradationRates: { ...DEFAULT_TIRE_CALIBRATION.degradationRates },
    gripLevels: { ...DEFAULT_TIRE_CALIBRATION.gripLevels },
    baseTrackTemp: DEFAULT_TIRE_CALIBRATION.baseTrackTemp,
    wearMultiplier: DEFAULT_TIRE_CALIBRATION.wearMultiplier,
  }

  if (stints.length === 0 || laps.length === 0) return base

  // Build a lap lookup: driver_number × lap_number → duration
  const lapMap = new Map<string, number>()
  for (const lap of laps) {
    if (lap.lap_duration != null && isFinite(lap.lap_duration) && lap.lap_duration > 0) {
      lapMap.set(`${lap.driver_number}:${lap.lap_number}`, lap.lap_duration)
    }
  }

  // Group readings by mapped Pirelli compound
  const samplesByCompound = new Map<TireCompound, CompoundSamples>()

  for (const stint of stints) {
    const pirelli = mapOpenF1CompoundToPirelli(stint.compound, circuitCompounds)
    if (!pirelli) continue

    let bucket = samplesByCompound.get(pirelli)
    if (!bucket) {
      bucket = { readings: [] }
      samplesByCompound.set(pirelli, bucket)
    }

    for (let lapNum = stint.lap_start; lapNum <= stint.lap_end; lapNum++) {
      const duration = lapMap.get(`${stint.driver_number}:${lapNum}`)
      if (duration == null) continue
      const age = stint.tyre_age_at_start + (lapNum - stint.lap_start)
      bucket.readings.push({ age, duration })
    }
  }

  // Per-compound linear regression: slope (seconds per lap of age) → degradation proxy
  for (const [compound, samples] of samplesByCompound) {
    if (samples.readings.length < 2) continue
    const slope = linearSlope(samples.readings)
    if (!isFinite(slope)) continue
    // Map slope (seconds/lap) to degradation (% wear/lap). Calibration factor
    // chosen so that a realistic 0.15s/lap slope on a soft tire → ~2.5 %/lap,
    // close to the existing C4/C5 defaults.
    const degradation = Math.max(0.1, Math.min(5.0, slope * 16 + 0.3))
    base.degradationRates[compound] = round2(degradation)
  }

  return base
}

// ---------------------------------------------------------------------------
// Overtake normalizer — stub that returns defaults. Real overtake calibration
// requires /v1/position endpoint data which is out of scope for Task 2 baseline.
// Hook is provided so profiles can be upgraded without a contract change.
// ---------------------------------------------------------------------------

export function normalizeOvertakeCalibration(laps: OpenF1Lap[]): OvertakeCalibration {
  if (laps.length === 0) {
    return { ...DEFAULT_OVERTAKE_CALIBRATION }
  }
  return { ...DEFAULT_OVERTAKE_CALIBRATION }
}

// ---------------------------------------------------------------------------
// End-to-end profile normalizer
// ---------------------------------------------------------------------------

export function normalizeCalibrationProfile(bundle: OpenF1SessionBundle): CalibrationProfile {
  return {
    circuitId: bundle.circuitId,
    source: 'openf1',
    tires: normalizeTireCalibration(bundle.laps, bundle.stints, bundle.circuitCompounds),
    weather: normalizeWeatherCalibration(bundle.weather),
    overtake: normalizeOvertakeCalibration(bundle.laps),
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp01(n: number): number {
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function linearSlope(points: Array<{ age: number; duration: number }>): number {
  const n = points.length
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0
  for (const p of points) {
    sumX += p.age
    sumY += p.duration
    sumXY += p.age * p.duration
    sumXX += p.age * p.age
  }
  const denominator = n * sumXX - sumX * sumX
  if (denominator === 0) return 0
  return (n * sumXY - sumX * sumY) / denominator
}
