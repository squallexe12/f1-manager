import type { CarPerformance } from '@/types/team'
import type { DriverAttributes } from '@/types/driver'
import type { TireCompound, TireLabel, WeatherState } from '@/types/race'
import type { PRNG } from '@/engine/core/prng'
import { computeQualifyingModifier } from '@/engine/practice/setup-modifier'

/**
 * Qualifying hot-lap model (plan §M2). Mirrors the car/driver band of the race
 * `calculateBaseLapTime` but for a single low-fuel hot lap: adds a low-fuel
 * bonus, a compound bonus (soft fastest), the full setup-confidence penalty, a
 * weather penalty, and a narrow experience-tightened variance. Consumes EXACTLY
 * one PRNG draw. Pure — no `Math.random`, no browser APIs.
 */

export const LOW_FUEL_BONUS = 2.5 // seconds faster than a race-fuel lap
export const COMPOUND_QUALI_BONUS: Record<TireLabel, number> = { soft: 1.2, medium: 0.6, hard: 0.2 }
export const QUALI_VARIANCE_RANGE = 0.3 // narrower than the race; experience tightens it further

// Occasional traffic-compromised lap (qualifying tow / yellow / blocked sector).
const TRAFFIC_PROB = 0.15
const TRAFFIC_MAX = 0.35

function carBandTime(car: CarPerformance, attributes: DriverAttributes): number {
  const carAvg = (car.downforce + car.straightSpeed + car.braking + car.cornering) / 4
  const carTime = 95 - (carAvg / 100) * 10 // 85–95s, same band as the race lap model
  const driverTime = -(attributes.pace / 100) * 2 // up to −2s
  return carTime + driverTime
}

function weatherPenalty(weather: WeatherState): number {
  return weather === 'wet' ? 8 : weather === 'damp' ? 3 : 0
}

/**
 * One qualifying hot-lap. EXACTLY 1 PRNG draw (the variance/traffic roll). The
 * setup penalty applies to all cars, but AI is clamped to neutral 50 upstream so
 * its penalty is 0. Returns the lap time (seconds) and the variance magnitude.
 */
export function calculateQualiLapTime(args: {
  car: CarPerformance
  attributes: DriverAttributes
  compound: TireCompound
  tireLabel: TireLabel
  setupConfidence: number
  weather: WeatherState
  prng: PRNG
}): { lapTime: number; variance: number } {
  const { car, attributes, tireLabel, setupConfidence, weather, prng } = args

  const varianceMag = QUALI_VARIANCE_RANGE * (1 - (attributes.experience / 100) * 0.5) // [0.15, 0.30]
  const draw = prng.next() // the ONLY draw
  const varianceTerm = (draw * 2 - 1) * varianceMag
  // Reuse the same draw for an occasional traffic loss — keeps the draw count at 1.
  const trafficLoss = draw < TRAFFIC_PROB ? (draw / TRAFFIC_PROB) * TRAFFIC_MAX : 0

  const lapTime =
    carBandTime(car, attributes) +
    weatherPenalty(weather) -
    LOW_FUEL_BONUS -
    COMPOUND_QUALI_BONUS[tireLabel] +
    computeQualifyingModifier(setupConfidence) +
    varianceTerm +
    trafficLoss

  return { lapTime, variance: varianceMag }
}

/** Map a compound to its label by position in the circuit's 3-compound set
 *  (ordered hardest → medium → softest). Unknown compounds → 'medium'. */
export function resolveTireLabel(compound: TireCompound, circuitCompounds: readonly TireCompound[]): TireLabel {
  const idx = circuitCompounds.indexOf(compound)
  if (idx === 0) return 'hard'
  if (idx === 2) return 'soft'
  return 'medium'
}

/** AI compound pick: softest in the final segment (chase the fastest time);
 *  medium in earlier segments (a touch of grid variety — AI ignores the player
 *  tire ledger, so this is purely a pace-shaping choice). */
export function selectAICompound(circuitCompounds: readonly TireCompound[], isFinalSegment: boolean): TireCompound {
  return isFinalSegment ? circuitCompounds[2] : circuitCompounds[1]
}
