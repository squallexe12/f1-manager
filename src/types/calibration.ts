import type { Circuit, TireCompound, WeatherState } from './race'

// ---------------------------------------------------------------------------
// Source discriminator — tracks data provenance for IP-07 calibration pipeline
// ---------------------------------------------------------------------------

export type CalibrationSource = 'openf1' | 'curated' | 'fallback'

// ---------------------------------------------------------------------------
// Tire calibration — per-circuit tire behavior
// ---------------------------------------------------------------------------

export interface TireCalibration {
  /** Base degradation rate per lap for each compound (% wear lost per lap) */
  degradationRates: Record<TireCompound, number>
  /** Base grip multiplier for each compound (0-1, softer = higher) */
  gripLevels: Record<TireCompound, number>
  /** Baseline track temperature in Celsius */
  baseTrackTemp: number
  /** Circuit-specific tire wear multiplier (replaces low/medium/high enum) */
  wearMultiplier: number
}

// ---------------------------------------------------------------------------
// Weather calibration — per-circuit weather behavior
// ---------------------------------------------------------------------------

export interface WeatherCalibration {
  /** Per-lap transition probability from each weather state */
  transitionProbabilities: Record<WeatherState, number>
  /** Baseline rain probability for this circuit (0-1) */
  baseRainProbability: number
  /** Typical temperature range at this circuit */
  temperatureRange: { min: number; max: number }
}

// ---------------------------------------------------------------------------
// Overtake calibration — per-circuit overtaking behavior
// ---------------------------------------------------------------------------

export interface OvertakeCalibration {
  /** Circuit-specific overtake rate modifier (replaces low/medium/high enum) */
  overtakeModifier: number
  /** Effectiveness of straight-mode / overtake-mode at this circuit (0-1) */
  drsEffectiveness: number
}

// ---------------------------------------------------------------------------
// Combined profile — one per circuit
// ---------------------------------------------------------------------------

export interface CalibrationProfile {
  circuitId: string
  source: CalibrationSource
  tires: TireCalibration
  weather: WeatherCalibration
  overtake: OvertakeCalibration
}

// ---------------------------------------------------------------------------
// Defaults — match current hardcoded constants from tire-model, weather, overtake
// ---------------------------------------------------------------------------

export const DEFAULT_TIRE_CALIBRATION: TireCalibration = {
  degradationRates: {
    C1: 0.8,
    C2: 1.1,
    C3: 1.5,
    C4: 2.0,
    C5: 2.8,
  },
  gripLevels: {
    C1: 0.88,
    C2: 0.92,
    C3: 0.95,
    C4: 0.98,
    C5: 1.00,
  },
  baseTrackTemp: 35,
  wearMultiplier: 1.0,
}

export const DEFAULT_WEATHER_CALIBRATION: WeatherCalibration = {
  transitionProbabilities: {
    dry: 0.015,
    damp: 0.015,
    wet: 0.015,
  },
  baseRainProbability: 0.1,
  temperatureRange: { min: 20, max: 45 },
}

export const DEFAULT_OVERTAKE_CALIBRATION: OvertakeCalibration = {
  overtakeModifier: 1.0,
  drsEffectiveness: 0.5,
}

// ---------------------------------------------------------------------------
// Factory — creates a fallback profile for any circuit ID
// ---------------------------------------------------------------------------

export function createFallbackProfile(circuitId: string): CalibrationProfile {
  return {
    circuitId,
    source: 'fallback',
    tires: {
      degradationRates: { ...DEFAULT_TIRE_CALIBRATION.degradationRates },
      gripLevels: { ...DEFAULT_TIRE_CALIBRATION.gripLevels },
      baseTrackTemp: DEFAULT_TIRE_CALIBRATION.baseTrackTemp,
      wearMultiplier: DEFAULT_TIRE_CALIBRATION.wearMultiplier,
    },
    weather: {
      transitionProbabilities: { ...DEFAULT_WEATHER_CALIBRATION.transitionProbabilities },
      baseRainProbability: DEFAULT_WEATHER_CALIBRATION.baseRainProbability,
      temperatureRange: { ...DEFAULT_WEATHER_CALIBRATION.temperatureRange },
    },
    overtake: { ...DEFAULT_OVERTAKE_CALIBRATION },
  }
}

// ---------------------------------------------------------------------------
// Circuit-derived fallback — maps the legacy string enums
// (tireWear / overtakingDifficulty / weatherVariability) to calibration
// values that preserve pre-IP-06 behavior when no OpenF1 profile is loaded.
// ---------------------------------------------------------------------------

const TIRE_WEAR_MULTIPLIER_BY_LEVEL: Record<'low' | 'medium' | 'high', number> = {
  low: 0.7,
  medium: 1.0,
  high: 1.4,
}

const WEATHER_VARIABILITY_BY_LEVEL: Record<'low' | 'medium' | 'high', number> = {
  low: 0.002,
  medium: 0.015,
  high: 0.035,
}

const OVERTAKE_MODIFIER_BY_LEVEL: Record<'low' | 'medium' | 'high', number> = {
  low: 1.3,
  medium: 1.0,
  high: 0.5,
}

export function deriveCalibrationFromCircuit(circuit: Circuit): CalibrationProfile {
  const wearMul = TIRE_WEAR_MULTIPLIER_BY_LEVEL[circuit.tireWear]
  const variability = WEATHER_VARIABILITY_BY_LEVEL[circuit.weatherVariability]
  const overtakeMod = OVERTAKE_MODIFIER_BY_LEVEL[circuit.overtakingDifficulty]

  return {
    circuitId: circuit.id,
    source: 'fallback',
    tires: {
      degradationRates: { ...DEFAULT_TIRE_CALIBRATION.degradationRates },
      gripLevels: { ...DEFAULT_TIRE_CALIBRATION.gripLevels },
      baseTrackTemp: DEFAULT_TIRE_CALIBRATION.baseTrackTemp,
      wearMultiplier: wearMul,
    },
    weather: {
      transitionProbabilities: { dry: variability, damp: variability, wet: variability },
      baseRainProbability: DEFAULT_WEATHER_CALIBRATION.baseRainProbability,
      temperatureRange: { ...DEFAULT_WEATHER_CALIBRATION.temperatureRange },
    },
    overtake: {
      overtakeModifier: overtakeMod,
      drsEffectiveness: DEFAULT_OVERTAKE_CALIBRATION.drsEffectiveness,
    },
  }
}
