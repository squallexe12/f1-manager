import type { Mood } from '@/types/driver'

export type MoodEventType =
  | 'race-win'
  | 'podium'
  | 'points-finish'
  | 'dnf'
  | 'team-order'
  | 'contract-expiring'
  | 'teammate-faster'
  | 'teammate-slower'
  | 'car-uncompetitive'
  | 'car-competitive'
  | 'narrative-positive'
  | 'narrative-negative'

export interface MoodEvent {
  type: MoodEventType
  intensity?: number // 0-1 multiplier, default 1
}

const MOOD_DELTAS: Record<MoodEventType, { motivation: number; frustration: number; confidence: number }> = {
  'race-win':           { motivation: 12, frustration: -15, confidence: 15 },
  'podium':             { motivation: 8,  frustration: -8,  confidence: 10 },
  'points-finish':      { motivation: 4,  frustration: -3,  confidence: 5 },
  'dnf':                { motivation: -5, frustration: 15,  confidence: -8 },
  'team-order':         { motivation: -3, frustration: 12,  confidence: -2 },
  'contract-expiring':  { motivation: -4, frustration: 8,   confidence: -3 },
  'teammate-faster':    { motivation: 3,  frustration: 5,   confidence: -5 },
  'teammate-slower':    { motivation: 2,  frustration: -3,  confidence: 5 },
  'car-uncompetitive':  { motivation: -3, frustration: 5,   confidence: -2 },
  'car-competitive':    { motivation: 3,  frustration: -3,  confidence: 3 },
  'narrative-positive':  { motivation: 5,  frustration: -4,  confidence: 4 },
  'narrative-negative':  { motivation: -4, frustration: 6,   confidence: -3 },
}

function clamp(val: number): number {
  return Math.max(0, Math.min(100, val))
}

/**
 * Update driver mood based on a list of events that occurred.
 * Returns a new Mood object (does not mutate input).
 */
export function updateMood(current: Mood, events: MoodEvent[]): Mood {
  let { motivation, frustration, confidence } = current

  for (const event of events) {
    const delta = MOOD_DELTAS[event.type]
    const intensity = event.intensity ?? 1

    motivation += delta.motivation * intensity
    frustration += delta.frustration * intensity
    confidence += delta.confidence * intensity
  }

  // Natural regression toward baseline (50) each update cycle
  motivation += (50 - motivation) * 0.02
  frustration += (50 - frustration) * 0.03 // frustration decays faster
  confidence += (50 - confidence) * 0.02

  return {
    motivation: clamp(Math.round(motivation)),
    frustration: clamp(Math.round(frustration)),
    confidence: clamp(Math.round(confidence)),
  }
}
