import type { CalibrationProfile } from '@/types/calibration'
import { createFallbackProfile } from '@/types/calibration'

// ---------------------------------------------------------------------------
// Runtime calibration registry
//
// Build-time sync writes profiles as JSON under src/data/calibration/*.json
// and imports them here. At runtime the registry is an in-memory map keyed by
// circuitId. Any unknown circuit resolves to a fallback profile so the engine
// never blocks on missing calibration data.
// ---------------------------------------------------------------------------

const registry = new Map<string, CalibrationProfile>()

export function registerCalibrationProfile(profile: CalibrationProfile): void {
  registry.set(profile.circuitId, deepCloneProfile(profile))
}

export function loadCalibrationProfile(circuitId: string): CalibrationProfile {
  const entry = registry.get(circuitId)
  if (!entry) return createFallbackProfile(circuitId)
  return deepCloneProfile(entry)
}

export function listRegisteredCircuits(): string[] {
  return Array.from(registry.keys())
}

export function clearCalibrationRegistry(): void {
  registry.clear()
}

// ---------------------------------------------------------------------------
// Deep clone — ensures caller mutations don't leak into the registry or vice
// versa. Profiles are plain JSON objects; structuredClone is the cheapest way
// to guarantee independence without hand-rolling per-field copies.
// ---------------------------------------------------------------------------

function deepCloneProfile(profile: CalibrationProfile): CalibrationProfile {
  return JSON.parse(JSON.stringify(profile)) as CalibrationProfile
}
