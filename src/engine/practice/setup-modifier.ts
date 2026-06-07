/**
 * Setup-confidence → lap-time modifier (plan §M1). Written in M1 for cohesion +
 * early test; consumed downstream in M6 (qualifying lap model + the authoritative
 * worker race path). Pure arithmetic — makes NO PRNG calls, so injecting it into
 * the race lap model never shifts the race PRNG stream (zero desync risk).
 *
 * `MAX_DELTA` is the single balance lever; the M8 env-gated harness pins the
 * qualifying-delta band [0.5s, 2.0s] that gates it. Setup confidence is
 * sub-dominant to car spread (~10s) and tires (~5s) — it shapes, never overrides.
 */
const MAX_DELTA = 1.5 // seconds, total swing across confidence 0..100

/** confidence 50 → 0s; 100 → -1.5s (faster); 0 → +1.5s (slower). Monotonic.
 *  Written as (50 - c) rather than -(c - 50) so the neutral case returns +0,
 *  not -0 (avoids Object.is / serialization surprises downstream). */
export function computeSetupModifier(setupConfidence: number): number {
  return ((50 - setupConfidence) / 50) * MAX_DELTA
}

/** Full effect in qualifying (a dialled-in car matters most over one hot lap). */
export const computeQualifyingModifier = (c: number): number => computeSetupModifier(c)

/** Half effect over a race distance (other factors dominate across many laps). */
export const computeRacePaceModifier = (c: number): number => computeSetupModifier(c) * 0.5
