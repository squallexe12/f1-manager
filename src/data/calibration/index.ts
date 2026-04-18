import type { Circuit } from '@/types/race'
import type { CalibrationProfile } from '@/types/calibration'
import { createFallbackProfile, deriveCalibrationFromCircuit } from '@/types/calibration'
import { BUILT_IN_CALIBRATION_PROFILES } from './built-in-profiles'
import { sanitizeTireCalibration } from './sanitize'

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
  const sanitized: CalibrationProfile = {
    ...profile,
    tires: sanitizeTireCalibration(profile.tires),
  }
  registry.set(profile.circuitId, deepCloneProfile(sanitized))
}

export function loadCalibrationProfile(circuitId: string): CalibrationProfile {
  const entry = registry.get(circuitId)
  if (!entry) return createFallbackProfile(circuitId)
  return deepCloneProfile(entry)
}

/**
 * Prefer a registered OpenF1 profile. If none exists, derive calibration from
 * the circuit's legacy string enums so race engines keep pre-IP-06 behavior.
 */
export function resolveCalibrationForCircuit(circuit: Circuit): CalibrationProfile {
  const entry = registry.get(circuit.id)
  if (entry) return deepCloneProfile(entry)
  return deriveCalibrationFromCircuit(circuit)
}

export function listRegisteredCircuits(): string[] {
  return Array.from(registry.keys())
}

export function clearCalibrationRegistry(): void {
  registry.clear()
}

/**
 * Re-hydrate the registry from the static built-in profile list. Tests that
 * need a clean slate can call `clearCalibrationRegistry()`; production code
 * rarely calls this directly — the hydration runs once at module init below.
 */
export function hydrateBuiltInProfiles(): void {
  for (const profile of BUILT_IN_CALIBRATION_PROFILES) {
    registerCalibrationProfile(profile)
  }
}

// Hydrate once at module init so any importer sees a fully-loaded registry.
hydrateBuiltInProfiles()

// ---------------------------------------------------------------------------
// Deep clone — ensures caller mutations don't leak into the registry or vice
// versa. Profiles are plain JSON objects; structuredClone is the cheapest way
// to guarantee independence without hand-rolling per-field copies.
// ---------------------------------------------------------------------------

function deepCloneProfile(profile: CalibrationProfile): CalibrationProfile {
  return JSON.parse(JSON.stringify(profile)) as CalibrationProfile
}
