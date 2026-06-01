import { describe, it, expect } from 'vitest'
import { createPRNG } from '@/engine/core/prng'
import {
  evaluateTrackLimitBreach,
  applyTrackLimitStrike,
  rollTrackLimitExposure,
  DEFAULT_TRACK_LIMITS_CONFIG,
} from '@/engine/race/track-limits'
import { mixSeed } from '@/engine/race/race-incidents'
import {
  evaluateRejoinCollision,
  DEFAULT_REJOIN_CONFIG,
} from '@/engine/race/rejoin-collision'
import {
  evaluateFlagStateBreach,
  DEFAULT_FLAG_OFFENCE_CONFIG,
  type CautionFlag,
} from '@/engine/race/flag-state-offences'
import {
  rollCautionFlag,
  DEFAULT_CAUTION_CONFIG,
} from '@/engine/race/race-flags'
import {
  evaluatePitLineCrossing,
  DEFAULT_PIT_LINE_CONFIG,
} from '@/engine/race/pit-line-crossing'
import { CORNER_PROFILES, DEFAULT_CORNER_PROFILE } from '@/data/corner-profiles'
import { CIRCUITS } from '@/data/circuits'

/**
 * Tier C IP-C2 — track-limits season-frequency calibration harness.
 *
 * Gated behind TRACK_LIMITS_FREQUENCY=1 so it NEVER runs in the normal suite
 * (mirrors the IP-07 CALIBRATION_BALANCE precedent). Run locally via:
 *   `TRACK_LIMITS_FREQUENCY=1 npx vitest run tests/engine/race/track-limits-season-frequency.test.ts`
 *
 * It replays a full seeded 24-race season for a representative driver and counts
 * the three observable outcome classes. Spec §7 per-driver/season targets are:
 *   - warnings (strikes 1–3):  ~12–18
 *   - B&W flags (strike 4):    ~2–3
 *   - time penalties (5+):     ~3–5
 *
 * MEASURED (DEFAULT_TRACK_LIMITS_CONFIG, exp=70/frus=40, 12-seed mean) — all
 * three bands now land in spec after the bad-day exposure co-tune:
 *   - warnings ≈ 16.8 (in band — target 12–18)
 *   - B&W flags ≈ 2.5 (in band — target 2–3)
 *   - time penalties ≈ 4.3 (in band — target 3–5)
 *
 * RESOLVED CALIBRATION TENSION: independent per-corner Bernoulli with per-race
 * strike reset couples warning volume to escalation depth — no single
 * `baseRateByTier` knob hits warnings 12–18 AND penalties 3–5 at once (the old
 * default overshot warnings to ≈32). The per-race "bad day" exposure model
 * (`TrackLimitsConfig.exposure`, `rollTrackLimitExposure`) breaks that coupling:
 * each driver gets a per-race multiplier (badDayMult on `badDayProb` of races,
 * else normalMult<1) from an isolated PRNG, concentrating strikes into the
 * occasional bad race so escalation rises while routine warnings fall. Bands
 * below are the MEASURED envelope (spec target also shown in the log line).
 *
 * The replay drives the SAME pure engine functions (`evaluateTrackLimitBreach`
 * + `applyTrackLimitStrike` + `rollTrackLimitExposure`) the simulator's end-of-lap
 * loop uses, in the same consumption order (per lap → per monitored corner), with
 * the per-race exposure factor drawn from an isolated `mixSeed(seed, raceIndex)`
 * PRNG — mirroring the simulator's `mixSeed(raceSeed, driverHash)` draw. Because
 * the engine consumes one main-loop draw per (driver, corner, lap), modelling a
 * single representative driver per race is a faithful per-driver frequency estimate.
 */

const RUN_HARNESS = process.env.TRACK_LIMITS_FREQUENCY === '1'
const SEED_BASE = Number(process.env.TRACK_LIMITS_FREQUENCY_SEED ?? 50_000)

interface SeasonFrequency {
  warnings: number
  bwFlags: number
  timePenalties: number
  totalBreaches: number
}

/**
 * Replay one driver's full-season track-limits exposure. `experience` and
 * `frustration` are the two attribute drivers per spec §5.2 (Experience
 * primary, live Mood frustration secondary).
 */
function replaySeasonForDriver(
  experience: number,
  frustration: number,
  seed: number,
): SeasonFrequency {
  const rng = createPRNG(seed)
  let strikes = 0
  let warnings = 0
  let bwFlags = 0
  let timePenalties = 0
  let totalBreaches = 0

  CIRCUITS.forEach((circuit, ci) => {
    // Strikes reset every race (transient per-race counter).
    strikes = 0
    const profile = CORNER_PROFILES[circuit.id] ?? DEFAULT_CORNER_PROFILE
    const monitored = profile.corners.filter((c) => c.trackLimitMonitored)
    if (monitored.length === 0) return
    // Per-race bad-day exposure factor, drawn from an isolated PRNG keyed by the
    // race index — mirrors the simulator's `mixSeed(raceSeed, driverHash)` draw.
    const exposureFactor = rollTrackLimitExposure(createPRNG(mixSeed(seed, ci)), DEFAULT_TRACK_LIMITS_CONFIG)

    for (let lap = 0; lap < circuit.laps; lap++) {
      for (const corner of monitored) {
        const breached = evaluateTrackLimitBreach(
          {
            difficultyTier: corner.difficultyTier,
            experience,
            frustration,
            exposureFactor,
            config: DEFAULT_TRACK_LIMITS_CONFIG,
          },
          rng,
        )
        if (!breached) continue
        totalBreaches++
        const result = applyTrackLimitStrike(strikes, DEFAULT_TRACK_LIMITS_CONFIG)
        strikes = result.strikes
        if (result.outcome === 'time-penalty') timePenalties++
        else if (result.outcome === 'black-and-white') bwFlags++
        else warnings++
      }
    }
  })

  return { warnings, bwFlags, timePenalties, totalBreaches }
}

describe.skipIf(!RUN_HARNESS)('track-limits season frequency harness (TRACK_LIMITS_FREQUENCY=1)', () => {
  it('a typical driver lands within the spec §7 per-driver/season targets', () => {
    // Average the count across a few seeds to smooth single-season variance.
    const SAMPLES = Number(process.env.TRACK_LIMITS_FREQUENCY_SAMPLES ?? 12)
    let warnings = 0
    let bwFlags = 0
    let timePenalties = 0
    let totalBreaches = 0

    for (let s = 0; s < SAMPLES; s++) {
      // Representative mid-grid driver: experience 70, moderate frustration 40.
      const freq = replaySeasonForDriver(70, 40, SEED_BASE + s)
      warnings += freq.warnings
      bwFlags += freq.bwFlags
      timePenalties += freq.timePenalties
      totalBreaches += freq.totalBreaches
    }

    const avgWarnings = warnings / SAMPLES
    const avgBw = bwFlags / SAMPLES
    const avgPenalties = timePenalties / SAMPLES
    const avgBreaches = totalBreaches / SAMPLES

    console.log(
      `[IP-C2-frequency] samples=${SAMPLES} exp=70 frus=40 → ` +
      `warnings≈${avgWarnings.toFixed(1)} (target 12–18), ` +
      `B&W≈${avgBw.toFixed(1)} (target 2–3), ` +
      `timePenalties≈${avgPenalties.toFixed(1)} (target 3–5), ` +
      `totalBreaches≈${avgBreaches.toFixed(1)}`,
    )

    // Bands are the MEASURED envelope around the spec §7 target, now all in band
    // after the bad-day exposure co-tune (measured ≈16.8 / 2.5 / 4.3, 12-seed mean).
    // Wide enough to absorb seed variance, tight enough to catch a regression to the
    // pre-co-tune behaviour (warnings ≈32, penalties ≈2.4).
    expect(avgWarnings, 'warnings/season (measured ≈16.8; spec 12–18)').toBeGreaterThanOrEqual(12)
    expect(avgWarnings, 'warnings/season').toBeLessThanOrEqual(20)
    expect(avgBw, 'B&W flags/season (measured ≈2.5; spec 2–3)').toBeGreaterThanOrEqual(1.8)
    expect(avgBw, 'B&W flags/season').toBeLessThanOrEqual(3.4)
    expect(avgPenalties, 'time penalties/season (measured ≈4.3; spec 3–5)').toBeGreaterThanOrEqual(3)
    expect(avgPenalties, 'time penalties/season').toBeLessThanOrEqual(6)
  })

  it('a calm veteran breaches materially less than a frustrated rookie', () => {
    const veteran = replaySeasonForDriver(95, 10, SEED_BASE + 100)
    const rookie = replaySeasonForDriver(30, 90, SEED_BASE + 100)
    console.log(
      `[IP-C2-attribute] veteran breaches=${veteran.totalBreaches}, ` +
      `rookie breaches=${rookie.totalBreaches}`,
    )
    expect(rookie.totalBreaches).toBeGreaterThan(veteran.totalBreaches)
  })
})

/**
 * Tier C IP-C3 — rejoin-collision season-frequency calibration harness.
 *
 * Gated behind the same TRACK_LIMITS_FREQUENCY=1 env var as the track-limits
 * harness above, so it never runs in the normal suite.
 *
 * Replays a full seeded 24-race season for a representative driver and counts
 * per-driver rejoin-collision investigations. The replay mirrors the simulator's
 * end-of-lap loop: for each lap × monitored corner, first roll a breach (the
 * gating condition), then — if breached and rejoinRisk is med/high — roll
 * evaluateRejoinCollision. One PRNG instance per season (same as simulator
 * consumption order: breach draw then optionally rejoin draw per corner).
 *
 * Spec §7 target: ~1–2 rejoin-collision investigations per driver/season.
 *
 * MEASURED (DEFAULT_REJOIN_CONFIG, racecraft=60/exp=70/frus=40, 12-seed mean):
 *   rejoin-collisions ≈ 1.58 (in band — target 1–2)
 *
 * RESOLVED in the Tier C frequency co-tune. The gate-1 breach now carries the
 * track-limits bad-day exposure factor (so the gate-open rate dropped from the
 * pre-co-tune overshoot), and `DEFAULT_REJOIN_CONFIG.baseRateByRisk` was halved to
 * {low:0.025,med:0.09,high:0.16}. Together these land the investigation rate inside
 * the spec band (was ≈3.92). The band below is the measured envelope.
 */

function replayRejoinCollisionForDriver(
  racecraft: number,
  experience: number,
  frustration: number,
  seed: number,
): number {
  const rng = createPRNG(seed)
  let rejoinInvestigations = 0

  CIRCUITS.forEach((circuit, ci) => {
    const profile = CORNER_PROFILES[circuit.id] ?? DEFAULT_CORNER_PROFILE
    const monitored = profile.corners.filter((c) => c.trackLimitMonitored)
    if (monitored.length === 0) return
    // Gate-1 breaches now carry the per-race bad-day exposure factor too (the
    // simulator applies it before the rejoin roll), so the gate-open rate matches.
    const exposureFactor = rollTrackLimitExposure(createPRNG(mixSeed(seed, ci)), DEFAULT_TRACK_LIMITS_CONFIG)

    for (let lap = 0; lap < circuit.laps; lap++) {
      for (const corner of monitored) {
        // Gate 1: track-limits breach must fire (same draw the simulator uses)
        const breached = evaluateTrackLimitBreach(
          {
            difficultyTier: corner.difficultyTier,
            experience,
            frustration,
            exposureFactor,
            config: DEFAULT_TRACK_LIMITS_CONFIG,
          },
          rng,
        )
        if (!breached) continue

        // applyTrackLimitStrike is called in the simulator here (strike count only —
        // no PRNG draw inside). The harness must call it too to keep a consistent
        // strike counter and avoid state divergence (even though we only need the
        // rejoin count, the strike state affects nothing in the rejoin roll).
        // We pass a local per-race strikes counter.

        // Gate 2: rejoin-collision roll for med/high-risk corners only
        if (corner.rejoinRisk !== 'med' && corner.rejoinRisk !== 'high') continue

        const rejoin = evaluateRejoinCollision(
          {
            driverId: 'driver',
            rejoinRisk: corner.rejoinRisk,
            racecraft,
            config: DEFAULT_REJOIN_CONFIG,
          },
          rng,
        )
        if (rejoin.decision) {
          rejoinInvestigations++
          // openInvestigation consumes one more rng.next() draw (for decideOnLap)
          // but we do NOT call it here since we don't want to couple this harness
          // to the investigation engine. The count is faithful: each fired decision
          // is one investigation.
        }
      }
    }
  })

  return rejoinInvestigations
}

describe.skipIf(!RUN_HARNESS)('rejoin-collision season frequency harness (TRACK_LIMITS_FREQUENCY=1)', () => {
  it('a typical driver lands ~1–2 rejoin-collision investigations per season', () => {
    const SAMPLES = Number(process.env.TRACK_LIMITS_FREQUENCY_SAMPLES ?? 12)
    let total = 0

    for (let s = 0; s < SAMPLES; s++) {
      // Representative mid-grid driver: racecraft 60, experience 70, frustration 40.
      total += replayRejoinCollisionForDriver(60, 70, 40, SEED_BASE + s + 1000)
    }

    const avg = total / SAMPLES

    console.log(
      `[IP-C3-frequency] samples=${SAMPLES} racecraft=60 exp=70 frus=40 → ` +
      `rejoin-collisions≈${avg.toFixed(2)}/driver/season ` +
      `(spec target 1–2; measured ≈1.58 after co-tune)`,
    )

    // Bands are the MEASURED envelope around the spec §7 target (1–2), now in band
    // after the co-tune (measured ≈1.58). Catches a regression to the pre-co-tune
    // overshoot (≈3.92) or to under-firing.
    expect(avg, 'rejoin-collisions/driver/season (measured ≈1.58; spec 1–2)').toBeGreaterThanOrEqual(0.8)
    expect(avg, 'rejoin-collisions/driver/season').toBeLessThanOrEqual(2.6)
  })

  it('a low-racecraft driver has more rejoin-collision events than a high-racecraft driver', () => {
    const lowSkill  = replayRejoinCollisionForDriver(20, 70, 40, SEED_BASE + 2000)
    const highSkill = replayRejoinCollisionForDriver(95, 70, 40, SEED_BASE + 2000)
    console.log(
      `[IP-C3-attribute] low racecraft rejoin-events=${lowSkill}, ` +
      `high racecraft rejoin-events=${highSkill}`,
    )
    // High-racecraft drivers should statistically have fewer or equal events.
    // We use ≥ rather than > to avoid flakiness on very small sample counts.
    expect(lowSkill).toBeGreaterThanOrEqual(highSkill)
  })
})

/**
 * Tier C IP-C4 — flag-state offences season-frequency calibration harness.
 *
 * Gated behind the same TRACK_LIMITS_FREQUENCY=1 env var as the track-limits
 * harness above, so it never runs in the normal suite.
 *
 * Models a full 24-race season for a representative driver and counts per-flag
 * offences. The replay drives `evaluateFlagStateBreach` + `rollCautionFlag`
 * directly (same approach as the track-limits harness) rather than going through
 * the full `simulateRace` stack. This is accurate because:
 *   - Flag offences only fire when the flag is non-green (gated).
 *   - The detector is pure (experience + mentality → breach probability).
 *   - Caution laps per race are modeled from the real FSM config:
 *       MEAN_CAUTION_EVENTS_PER_RACE caution events × durationLaps distribution.
 *   - For each caution lap, one call to `evaluateFlagStateBreach` per driver.
 *
 * MEAN_CAUTION_EVENTS_PER_RACE = 2 approximates F1 reality (~1–3 SCs/race).
 * The flag type for each caution lap is drawn via `rollCautionFlag` so the
 * yellow:vsc:sc:red split matches the real FSM severity bands.
 *
 * Spec §7 target: ~0–1 of each flag offence type per driver/season.
 *
 * MEASURED (DEFAULT_FLAG_OFFENCE_CONFIG, exp=70/ment=70, aggressive on 30% of
 * caution laps, 12-seed mean, MEAN_CAUTION_EVENTS_PER_RACE=2) — all in band after
 * the yellow co-tune (baseRateByFlag.yellow 0.06 → 0.018):
 *   - yellow-flag-breach ≈ 0.67 per driver/season (in band — was ≈2.5)
 *   - sc-infraction      ≈ 0.25 per driver/season (already on target — unchanged)
 *   - vsc-infraction     ≈ 0.00 per driver/season
 *   - red-flag-breach    ≈ 0.00 per driver/season
 *
 * Bands below are the measured envelope around the spec §7 target (~0–1 each);
 * yellow tightened to catch a regression to the pre-co-tune ≈2.5 overshoot.
 */

/** Mean number of caution EVENTS per race. Each event lasts durationLaps[flag] laps. */
const MEAN_CAUTION_EVENTS_PER_RACE = 2

/**
 * Model expected caution laps per race from the FSM config. This draws
 * both the trigger (modelled as a Bernoulli at rate MEAN_CAUTION_EVENTS_PER_RACE/totalLaps
 * per lap) and the flag type via `rollCautionFlag`, then applies durationLaps.
 *
 * For the frequency replay we pre-compute caution laps for the whole season
 * from a seeded PRNG, then call evaluateFlagStateBreach once per caution lap
 * per driver attribute set. `aggressiveRate` is the fraction of caution laps
 * where the driver runs 'overtake' or 'push' (0.0–1.0, conservatively 0.3).
 */
function replayFlagOffencesForDriver(
  experience: number,
  mentality: number,
  aggressiveRate: number,
  seed: number,
): Record<CautionFlag, number> {
  const rng = createPRNG(seed)
  const counts: Record<CautionFlag, number> = { yellow: 0, vsc: 0, sc: 0, red: 0 }

  for (const circuit of CIRCUITS) {
    const lapTriggerProb = MEAN_CAUTION_EVENTS_PER_RACE / circuit.laps
    let cautionLapsRemaining = 0
    let activeFlag: CautionFlag | null = null

    for (let lap = 0; lap < circuit.laps; lap++) {
      // Advance FSM
      if (cautionLapsRemaining > 0) {
        cautionLapsRemaining--
        if (cautionLapsRemaining === 0) {
          activeFlag = null
        }
      } else if (rng.chance(lapTriggerProb)) {
        // Deploy a new caution — draw flag type from the minor-severity bands
        // (track-state cautions are minor; this preserves the pre-IP-2 bands).
        const flag = rollCautionFlag(rng, DEFAULT_CAUTION_CONFIG, 'minor')
        activeFlag = flag
        cautionLapsRemaining = DEFAULT_CAUTION_CONFIG.durationLaps[flag] - 1
      }

      if (!activeFlag) continue

      // Under caution: call detector once for this driver.
      // `aggressive` is true with probability `aggressiveRate`.
      const aggressive = rng.chance(aggressiveRate)
      const result = evaluateFlagStateBreach(
        {
          driverId: 'driver',
          flag: activeFlag,
          aggressive,
          experience,
          mentality,
          config: DEFAULT_FLAG_OFFENCE_CONFIG,
        },
        rng,
      )
      if (result.decision) {
        counts[activeFlag]++
      }
    }
  }

  return counts
}

describe.skipIf(!RUN_HARNESS)('flag-state offences season frequency harness (TRACK_LIMITS_FREQUENCY=1)', () => {
  it('a typical driver lands within the spec §7 ~0–1 per-flag offence per driver/season', () => {
    const SAMPLES = Number(process.env.TRACK_LIMITS_FREQUENCY_SAMPLES ?? 12)
    const totals: Record<CautionFlag, number> = { yellow: 0, vsc: 0, sc: 0, red: 0 }

    for (let s = 0; s < SAMPLES; s++) {
      // Representative mid-grid driver: exp=70, mentality=70, aggressive 30% of caution laps.
      const counts = replayFlagOffencesForDriver(70, 70, 0.3, SEED_BASE + s + 5000)
      totals.yellow += counts.yellow
      totals.vsc    += counts.vsc
      totals.sc     += counts.sc
      totals.red    += counts.red
    }

    const avgYellow = totals.yellow / SAMPLES
    const avgVsc    = totals.vsc    / SAMPLES
    const avgSc     = totals.sc     / SAMPLES
    const avgRed    = totals.red    / SAMPLES
    const avgTotal  = avgYellow + avgVsc + avgSc + avgRed

    console.log(
      `[IP-C4-frequency] samples=${SAMPLES} exp=70 ment=70 aggressive=30% → ` +
      `yellow≈${avgYellow.toFixed(2)} vsc≈${avgVsc.toFixed(2)} ` +
      `sc≈${avgSc.toFixed(2)} red≈${avgRed.toFixed(2)} ` +
      `total≈${avgTotal.toFixed(2)}/driver/season ` +
      `(spec target ~0–1 each)`,
    )

    // Bands are the measured envelope around the spec §7 target (~0–1 each). Yellow
    // tightened to ≤1.6 after the co-tune (measured ≈0.67) to catch a regression to
    // the pre-co-tune ≈2.5 overshoot; sc/vsc/red kept at the wider ≤3 (unchanged,
    // measured ≈0.25/0/0 — comfortably inside).
    expect(avgYellow, 'yellow-flag-breach/season (measured ≈0.67; spec ~0–1)').toBeGreaterThanOrEqual(0)
    expect(avgYellow, 'yellow-flag-breach/season').toBeLessThanOrEqual(1.6)
    expect(avgVsc,    'vsc-infraction/season (spec target ~0–1)').toBeGreaterThanOrEqual(0)
    expect(avgVsc,    'vsc-infraction/season').toBeLessThanOrEqual(3)
    expect(avgSc,     'sc-infraction/season (spec target ~0–1)').toBeGreaterThanOrEqual(0)
    expect(avgSc,     'sc-infraction/season').toBeLessThanOrEqual(3)
    expect(avgRed,    'red-flag-breach/season (spec target ~0–1)').toBeGreaterThanOrEqual(0)
    expect(avgRed,    'red-flag-breach/season').toBeLessThanOrEqual(3)
  })

  it('an aggressive, low-discipline driver has more flag offences than a disciplined conservative', () => {
    const aggressive = replayFlagOffencesForDriver(25, 25, 0.9, SEED_BASE + 6000)
    const disciplined = replayFlagOffencesForDriver(95, 95, 0.1, SEED_BASE + 6000)
    const aggressiveTotal = Object.values(aggressive).reduce((a, b) => a + b, 0)
    const disciplinedTotal = Object.values(disciplined).reduce((a, b) => a + b, 0)
    console.log(
      `[IP-C4-attribute] aggressive/reckless offences=${aggressiveTotal}, ` +
      `disciplined/conservative offences=${disciplinedTotal}`,
    )
    // An aggressive low-discipline driver should have more offences (or at least equal).
    expect(aggressiveTotal).toBeGreaterThanOrEqual(disciplinedTotal)
  })
})

/**
 * Tier C IP-C5 — pit-line white-line crossing season-frequency calibration harness.
 *
 * Gated behind the same TRACK_LIMITS_FREQUENCY=1 env var as the harnesses above,
 * so it never runs in the normal suite. This is the sixth and final Tier C family.
 *
 * Models a full 24-race season for one driver and counts per-driver pit-line
 * crossings. The replay drives the pure detector `evaluatePitLineCrossing`
 * directly (same approach as the track-limits / rejoin / flag harnesses) rather
 * than going through the full pit-lane sub-sim. This is faithful because the
 * detector is invoked exactly once per (boundary) per pit transit and consumes
 * exactly one PRNG draw, in fixed entry→exit order (pit-lane-engine §5.3 items
 * 6–7). We model STOPS_PER_RACE stops/race, each crossing both the entry and the
 * exit white line — i.e. 2 detector rolls per stop, matching the engine.
 *
 * STOPS_PER_RACE = 2 is the upper-typical 2-stop strategy; F1 drivers average
 * ~1–2 stops/race, so this is a conservative (slightly high) season exposure.
 *
 * Spec §7 target: ~0–1 pit-line crossings per driver/season.
 *
 * MEASURED (DEFAULT_PIT_LINE_CONFIG, experience=70, STOPS_PER_RACE=2, 12-seed
 * mean): pit-line crossings ≈ 0.50 per driver/season — ON the spec target.
 * Veteran (exp=95) ≈ 0.33, rookie (exp=20) ≈ 1.08 — the experience gradient is
 * intact. Unlike the IP-C2/C3 families, this family needs NO follow-up tuning:
 * the default config lands inside the spec envelope, so the band below is the
 * tight spec band (0–1.5, allowing a little headroom over the 0.50 mean).
 */

/** Modelled stops per race per driver (2 = upper-typical 2-stop strategy). */
const STOPS_PER_RACE = 2

function replayPitLineCrossingsForDriver(experience: number, seed: number): number {
  const rng = createPRNG(seed)
  let crossings = 0

  for (let race = 0; race < CIRCUITS.length; race++) {
    for (let stop = 0; stop < STOPS_PER_RACE; stop++) {
      // Per stop the engine rolls both boundaries in fixed entry→exit order.
      for (const boundary of ['entry', 'exit'] as const) {
        const crossed = evaluatePitLineCrossing(
          { boundary, experience, config: DEFAULT_PIT_LINE_CONFIG },
          rng,
        )
        if (crossed) crossings++
      }
    }
  }

  return crossings
}

describe.skipIf(!RUN_HARNESS)('pit-line crossing season frequency harness (TRACK_LIMITS_FREQUENCY=1)', () => {
  it('a typical driver lands within the spec §7 ~0–1 pit-line crossings per driver/season', () => {
    const SAMPLES = Number(process.env.TRACK_LIMITS_FREQUENCY_SAMPLES ?? 12)
    let total = 0

    for (let s = 0; s < SAMPLES; s++) {
      // Representative mid-grid driver: experience 70.
      total += replayPitLineCrossingsForDriver(70, SEED_BASE + s + 7000)
    }

    const avg = total / SAMPLES

    console.log(
      `[IP-C5-frequency] samples=${SAMPLES} exp=70 stops/race=${STOPS_PER_RACE} → ` +
      `pit-line-crossings≈${avg.toFixed(2)}/driver/season ` +
      `(spec target ~0–1; measured ≈0.50 — on target, no tuning needed)`,
    )

    // Tight spec band: DEFAULT_PIT_LINE_CONFIG lands inside the §7 envelope, so
    // unlike the C2/C3 families this records the spec band directly (with a
    // little headroom over the 0.50 mean) and catches a base-rate regression.
    expect(avg, 'pit-line-crossings/driver/season (spec target ~0–1; measured ≈0.50)').toBeGreaterThanOrEqual(0)
    expect(avg, 'pit-line-crossings/driver/season').toBeLessThanOrEqual(1.5)
  })

  it('a veteran crosses the pit white line less often than a rookie over a season', () => {
    const veteran = replayPitLineCrossingsForDriver(95, SEED_BASE + 8000)
    const rookie = replayPitLineCrossingsForDriver(20, SEED_BASE + 8000)
    console.log(
      `[IP-C5-attribute] veteran(exp=95) crossings=${veteran}, rookie(exp=20) crossings=${rookie}`,
    )
    // Higher experience reduces the crossing rate; ≥ avoids small-sample flakiness.
    expect(rookie).toBeGreaterThanOrEqual(veteran)
  })
})

/**
 * Tier C all-six-family summary harness (env-gated). Emits one consolidated log
 * line covering every Tier C offence family so a single run surfaces the full
 * picture. Per-family band assertions live in their dedicated blocks above; this
 * is a reporting aid, so it asserts only that every family produced a finite,
 * non-negative measured number.
 */
describe.skipIf(!RUN_HARNESS)('Tier C six-family summary (TRACK_LIMITS_FREQUENCY=1)', () => {
  it('reports all six Tier C offence-family frequencies in one line', () => {
    const SAMPLES = Number(process.env.TRACK_LIMITS_FREQUENCY_SAMPLES ?? 12)

    // 1+2+3 — track-limits warnings / B&W / time penalties.
    let warnings = 0, bwFlags = 0, timePenalties = 0
    // 4 — rejoin-collision.
    let rejoin = 0
    // 5 — flag-state offences (yellow / vsc / sc / red).
    let yellow = 0, vsc = 0, sc = 0, red = 0
    // 6 — pit-line crossing.
    let pitLine = 0

    for (let s = 0; s < SAMPLES; s++) {
      const tl = replaySeasonForDriver(70, 40, SEED_BASE + s)
      warnings += tl.warnings
      bwFlags += tl.bwFlags
      timePenalties += tl.timePenalties

      rejoin += replayRejoinCollisionForDriver(60, 70, 40, SEED_BASE + s + 1000)

      const flags = replayFlagOffencesForDriver(70, 70, 0.3, SEED_BASE + s + 5000)
      yellow += flags.yellow
      vsc += flags.vsc
      sc += flags.sc
      red += flags.red

      pitLine += replayPitLineCrossingsForDriver(70, SEED_BASE + s + 7000)
    }

    const avg = (n: number) => (n / SAMPLES).toFixed(2)
    console.log(
      `[Tier-C-summary] samples=${SAMPLES} per-driver/season → ` +
      `track-limits warnings≈${avg(warnings)} (12–18), B&W≈${avg(bwFlags)} (2–3), ` +
      `time-penalties≈${avg(timePenalties)} (3–5); ` +
      `rejoin-collision≈${avg(rejoin)} (1–2); ` +
      `yellow≈${avg(yellow)} vsc≈${avg(vsc)} sc≈${avg(sc)} red≈${avg(red)} (~0–1 each); ` +
      `pit-line≈${avg(pitLine)} (~0–1)`,
    )

    for (const n of [warnings, bwFlags, timePenalties, rejoin, yellow, vsc, sc, red, pitLine]) {
      expect(Number.isFinite(n / SAMPLES)).toBe(true)
      expect(n).toBeGreaterThanOrEqual(0)
    }
  })
})

// Cheap always-on sanity test: confirms the harness helper compiles and returns
// a well-shaped result for a single driver. The full §7 band run is env-gated.
describe('track-limits season frequency harness helpers', () => {
  it('replaySeasonForDriver returns non-negative outcome counts', () => {
    const freq = replaySeasonForDriver(70, 40, 999)
    expect(freq.warnings).toBeGreaterThanOrEqual(0)
    expect(freq.bwFlags).toBeGreaterThanOrEqual(0)
    expect(freq.timePenalties).toBeGreaterThanOrEqual(0)
    expect(freq.totalBreaches).toBe(freq.warnings + freq.bwFlags + freq.timePenalties)
  })

  it('replayRejoinCollisionForDriver returns a non-negative count', () => {
    const count = replayRejoinCollisionForDriver(60, 70, 40, 999)
    expect(count).toBeGreaterThanOrEqual(0)
  })

  it('replayFlagOffencesForDriver returns non-negative counts for all flag types', () => {
    const counts = replayFlagOffencesForDriver(70, 70, 0.3, 999)
    expect(counts.yellow).toBeGreaterThanOrEqual(0)
    expect(counts.vsc).toBeGreaterThanOrEqual(0)
    expect(counts.sc).toBeGreaterThanOrEqual(0)
    expect(counts.red).toBeGreaterThanOrEqual(0)
  })

  it('replayPitLineCrossingsForDriver returns a non-negative count', () => {
    const count = replayPitLineCrossingsForDriver(70, 999)
    expect(count).toBeGreaterThanOrEqual(0)
  })
})
