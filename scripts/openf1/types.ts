import type { TireCompound } from '../../src/types/race'

// ---------------------------------------------------------------------------
// OpenF1 raw API shapes — mirrors api.openf1.net response fields we consume.
// Only fields we actually use are declared; unknown fields are ignored.
// ---------------------------------------------------------------------------

export interface OpenF1Session {
  session_key: number
  session_name: string // e.g. "Race"
  circuit_short_name: string // e.g. "Sakhir"
  country_name: string
  year: number
  date_start: string // ISO
}

export interface OpenF1Lap {
  driver_number: number
  lap_number: number
  lap_duration: number | null
}

export type OpenF1CompoundLabel = 'SOFT' | 'MEDIUM' | 'HARD' | 'INTERMEDIATE' | 'WET'

export interface OpenF1Stint {
  driver_number: number
  stint_number: number
  lap_start: number
  lap_end: number
  compound: OpenF1CompoundLabel
  tyre_age_at_start: number
}

export interface OpenF1Weather {
  date: string
  air_temperature: number
  track_temperature: number
  /** Rainfall indicator: 0 = dry, non-zero = rain present */
  rainfall: number
  humidity: number
}

// ---------------------------------------------------------------------------
// Consolidated session bundle — pre-normalization container passed to the
// pure normalizer functions. All fetch I/O happens before this shape is built.
// ---------------------------------------------------------------------------

export interface OpenF1SessionBundle {
  circuitId: string
  circuitCompounds: TireCompound[]
  sessionKey: number
  laps: OpenF1Lap[]
  stints: OpenF1Stint[]
  weather: OpenF1Weather[]
}
