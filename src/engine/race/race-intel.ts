import type { Circuit, TireCompound } from '@/types/race'
import type { CalibrationProfile, CalibrationSource } from '@/types/calibration'

/**
 * Pre-race intelligence surface (IP-07 Task 5).
 *
 * Pure derivation from a CalibrationProfile + Circuit. No side effects, no
 * stores, no network. UI components consume this verbatim and render the
 * player-facing intel panel shown on the Strategy pre-race screen.
 */
export interface RaceIntel {
  /** Expected stint length in laps for each of the circuit's Pirelli compounds */
  expectedStintLaps: Partial<Record<TireCompound, number>>
  /** Pit-loss seconds range: mean ± 1 stddev, rounded for display */
  pitLossRangeSec: { low: number; mean: number; high: number }
  /** Short natural-language hint about overtake opportunity at this circuit */
  overtakeHint: string
  /** Short natural-language summary of expected weather volatility */
  weatherOutlook: string
  /** Provenance — drives the "Fallback data" badge on the panel */
  dataSource: CalibrationSource
}

export function deriveRaceIntel(profile: CalibrationProfile, circuit: Circuit): RaceIntel {
  const expectedStintLaps: Partial<Record<TireCompound, number>> = {}
  for (const compound of circuit.compounds) {
    expectedStintLaps[compound] = profile.stint.expectedLaps[compound]
  }

  const mean = profile.pitLoss.meanLossSeconds
  const stddev = profile.pitLoss.stddevSeconds
  const pitLossRangeSec = {
    low: round1(mean - stddev),
    mean: round1(mean),
    high: round1(mean + stddev),
  }

  return {
    expectedStintLaps,
    pitLossRangeSec,
    overtakeHint: describeOvertakeHint(circuit, profile),
    weatherOutlook: describeWeatherOutlook(profile),
    dataSource: profile.source,
  }
}

function describeOvertakeHint(circuit: Circuit, profile: CalibrationProfile): string {
  // Prefer explicit overtake modifier when it's been shifted off the default;
  // otherwise fall back to the circuit enum that the player already sees
  // elsewhere in the pre-race surface.
  const mod = profile.overtake.overtakeModifier
  if (mod > 1.15) return 'Low difficulty — straightforward overtakes on long straights'
  if (mod < 0.75) return 'High difficulty — track position is critical, overtaking is rare'

  switch (circuit.overtakingDifficulty) {
    case 'low':
      return 'Low difficulty — straightforward overtakes on long straights'
    case 'medium':
      return 'Medium difficulty — picks usually come from strategy and tire delta'
    case 'high':
      return 'High difficulty — track position is critical, overtaking is rare'
  }
}

function describeWeatherOutlook(profile: CalibrationProfile): string {
  const rainP = profile.weather.baseRainProbability
  if (rainP >= 0.35) return 'Volatile — rain risk high, prepare for intermediate calls'
  if (rainP >= 0.15) return 'Mixed — rain possible during the race window'
  if (rainP > 0) return 'Mostly dry with a small chance of showers'
  return 'Dry outlook — historical data shows no rainfall in this window'
}

function round1(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 10) / 10
}
