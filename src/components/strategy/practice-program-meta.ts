import type { PracticeProgram } from '@/types/weekend'

/**
 * UI-layer display metadata for the four practice programs (plan §M5). The
 * `timeMins` / `sets` fields MIRROR the engine's `PROGRAM_COSTS`
 * (src/engine/practice/practice-engine.ts) — kept local so the UI layer imports
 * no engine values (AGENTS.md: components import nothing from src/engine except
 * types). If the engine costs change, update this mirror to match.
 */
export interface PracticeProgramMeta {
  id: PracticeProgram
  label: string
  icon: string
  description: string
  timeMins: number
  sets: number
}

export const PRACTICE_PROGRAM_META: Record<PracticeProgram, PracticeProgramMeta> = {
  'race-pace': {
    id: 'race-pace',
    label: 'Race Pace',
    icon: 'R',
    description: 'Long runs to read tire degradation and fuel behaviour',
    timeMins: 25,
    sets: 1,
  },
  'qualifying-sim': {
    id: 'qualifying-sim',
    label: 'Qualifying Sim',
    icon: 'Q',
    description: 'Low-fuel hot laps to sharpen single-lap setup',
    timeMins: 20,
    sets: 1,
  },
  'tire-test': {
    id: 'tire-test',
    label: 'Tire Test',
    icon: 'T',
    description: 'Evaluate compounds to find the strategy window',
    timeMins: 25,
    sets: 2,
  },
  'setup-work': {
    id: 'setup-work',
    label: 'Setup Work',
    icon: 'S',
    description: 'Dial car balance for maximum setup confidence',
    timeMins: 15,
    sets: 1,
  },
}

/** Stable display order — Race Pace, Qualifying Sim, Tire Test, Setup Work. */
export const PRACTICE_PROGRAM_ORDER: PracticeProgram[] = [
  'race-pace',
  'qualifying-sim',
  'tire-test',
  'setup-work',
]
