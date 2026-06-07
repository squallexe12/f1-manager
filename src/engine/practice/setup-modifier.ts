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
/** TOTAL lap-time swing (seconds) between the worst (0) and best (100) setup
 *  confidence — i.e. the confidence-100-vs-0 delta. The M8 balance harness gates
 *  this to the [0.5s, 2.0s] band; 1.5 sits mid-band. (NB: the plan's literal M1
 *  formula `-((c-50)/50)*MAX_DELTA` yields ±MAX_DELTA = a 3.0s 100-vs-0 swing,
 *  which violates both the M2 "delta ≤ 1.5s" test and the M8 band — so MAX_DELTA
 *  is treated as the FULL swing here, halved into a ±0.75 deviation about neutral,
 *  matching the plan's own "total swing" comment and acceptance criteria.) */
const MAX_DELTA = 1.5

/** confidence 50 → 0s; 100 → -0.75s (faster); 0 → +0.75s (slower); a 1.5s total
 *  swing. Monotonic. Written as (50 - c) so the neutral case returns +0, not -0
 *  (avoids Object.is / serialization surprises downstream). */
export function computeSetupModifier(setupConfidence: number): number {
  return ((50 - setupConfidence) / 50) * (MAX_DELTA / 2)
}

/** Full effect in qualifying (a dialled-in car matters most over one hot lap). */
export const computeQualifyingModifier = (c: number): number => computeSetupModifier(c)

/** Half effect over a race distance (other factors dominate across many laps). */
export const computeRacePaceModifier = (c: number): number => computeSetupModifier(c) * 0.5
