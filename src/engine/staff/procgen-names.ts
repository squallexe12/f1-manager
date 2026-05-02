import type { PRNG } from '@/engine/core/prng'

/**
 * Tier B v2 — deterministic procgen of staff names + nationalities.
 *
 * Pools are intentionally short: the texture comes from the gameplay loop
 * (hiring, attribute distribution, salary tiers), not from name novelty.
 * Expand pools later if playtest exposes "feels like the same crew across
 * saves" complaints.
 */

const FIRST_NAMES = [
  'Marco', 'Luca', 'Andrea', 'Nicola', 'Giovanni', 'Stefano', 'Paolo', 'Roberto',
  'Hans', 'Klaus', 'Erik', 'Mateusz', 'Lukas', 'Ivan',
  'James', 'David', 'Daniel', 'Thomas', 'Mark', 'Paul', 'Liam', 'Oliver',
  'Pierre', 'Jean', 'Antoine', 'Lucas',
  'Carlos', 'Diego', 'Javier', 'Miguel', 'Pablo',
  'Raj', 'Arjun', 'Vikram',
  'Hiroshi', 'Kenji', 'Akira', 'Takeshi',
  'Felipe', 'Bruno', 'Rafael', 'Tiago',
] as const

const LAST_NAMES = [
  'Rossi', 'Bianchi', 'Romano', 'Esposito', 'Marino', 'Greco',
  'Müller', 'Schmidt', 'Bauer', 'Weber', 'Fischer',
  'Smith', 'Brown', 'Taylor', 'Walker', 'Wright', 'Hall', 'Green',
  'Dubois', 'Martin', 'Bernard', 'Laurent',
  'García', 'Hernández', 'López', 'Ruiz', 'Gómez',
  'Patel', 'Sharma', 'Singh',
  'Tanaka', 'Sato', 'Suzuki', 'Yamamoto',
  'Silva', 'Pereira', 'Costa', 'Santos',
  'Nakamura', 'Kobayashi', 'Andersson', 'Lindqvist',
] as const

const NATIONALITIES = [
  'Italian', 'German', 'British', 'French', 'Spanish', 'Brazilian',
  'Japanese', 'Indian', 'Polish', 'Swedish', 'Dutch', 'Belgian',
] as const

export interface ProcgenIdentity {
  firstName: string
  lastName: string
  nationality: string
  age: number
}

/**
 * Generate one staff identity deterministically from the next PRNG values.
 * Burns four PRNG calls per call: firstName, lastName, nationality, age.
 */
export function generateIdentity(rng: PRNG, ageMin: number, ageMax: number): ProcgenIdentity {
  const firstName = FIRST_NAMES[Math.floor(rng.next() * FIRST_NAMES.length)]
  const lastName = LAST_NAMES[Math.floor(rng.next() * LAST_NAMES.length)]
  const nationality = NATIONALITIES[Math.floor(rng.next() * NATIONALITIES.length)]
  const age = Math.floor(ageMin + rng.next() * (ageMax - ageMin + 1))
  return { firstName, lastName, nationality, age }
}
