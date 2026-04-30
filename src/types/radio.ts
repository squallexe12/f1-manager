import type { RadioCategory, RadioSpeaker, RadioTone } from '@/types/race'

export type RadioArchetype =
  | 'calm-pro'
  | 'hot-headed'
  | 'spiritual'
  | 'emotional'
  | 'rookie'
  | 'veteran'

export interface DriverRadioProfile {
  driverId: string
  archetypes: [RadioArchetype, RadioArchetype?]
  signatureLines?: Partial<Record<RadioCategory, string[]>>
  catchphraseChance?: number  // 0..1, default 0.25
}

export interface RadioTemplate {
  category: RadioCategory
  speaker: RadioSpeaker
  text: string
  archetypes?: RadioArchetype[]   // empty = generic, eligible to all
  tone?: RadioTone
  minFrustration?: number         // 0-100, default 0
  maxFrustration?: number         // 0-100, default 100
  weight?: number                 // pick weight, default 1
}
