export interface OvertakeInput {
  performanceDelta: number // positive = attacker is faster (seconds per lap)
  racecraft: number        // attacker's racecraft attribute (0-100)
  circuitDifficulty: 'low' | 'medium' | 'high'
  tireDelta: number        // positive = attacker has fresher tires (wear difference)
}

export interface OvertakeResult {
  probability: number     // 0-1
  estimatedLaps: number   // laps until overtake likely
}

const CIRCUIT_MODIFIER: Record<string, number> = {
  low: 1.3,    // Easy to overtake (long straights, DRS zones)
  medium: 1.0,
  high: 0.5,   // Hard to overtake (narrow, few opportunities)
}

export function calculateOvertakeProbability(input: OvertakeInput): OvertakeResult {
  const { performanceDelta, racecraft, circuitDifficulty, tireDelta } = input

  const circuitMod = CIRCUIT_MODIFIER[circuitDifficulty] ?? 1.0

  // Base probability from performance delta (0.5s delta → ~30% per lap)
  const perfComponent = Math.max(0, performanceDelta) * 0.6

  // Racecraft bonus (80 racecraft → 0.08 bonus)
  const racecraftComponent = (racecraft / 1000)

  // Tire advantage (10% wear delta → 0.05 bonus)
  const tireComponent = Math.max(0, tireDelta) * 0.005

  const rawProbability = (perfComponent + racecraftComponent + tireComponent) * circuitMod

  const probability = Math.max(0, Math.min(1, rawProbability))

  // Estimated laps: inverse of probability (clamped)
  const estimatedLaps = probability > 0.01 ? Math.ceil(1 / probability) : 99

  return { probability, estimatedLaps }
}
