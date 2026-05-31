import type { CarPerformance } from '@/types/team'
import type { DriverAttributes, Mood } from '@/types/driver'
import type {
  TireCompound, TireState, LapResult, RaceStrategy,
  DriverCommand, CommentaryEntry, RaceIncident, WeatherState, AppliedPenalty,
  RadioCategory, RadioSpeaker, RaceFlag,
} from '@/types/race'
import type { CalibrationProfile } from '@/types/calibration'
import type { PRNG } from '@/engine/core/prng'
import { createPRNG } from '@/engine/core/prng'
import { getTirePerformance, degradeTire } from './tire-model'
import { calculateOvertakeProbability } from './overtake'
import { WeatherEngine } from './weather'
import { resolveCalibrationForCircuit } from '@/data/calibration'
import { resolveInvestigations, selectSanction, evaluateContestedEvent, openInvestigation } from './penalty-engine'
import { DEFAULT_PENALTY_CALIBRATION } from '@/data/penalty-calibration'
import { simulatePitLane, type PitLaneEvent, type PitLaneSimCarInput } from './pit-lane-engine'
import {
  registerSanctionDeadline,
  clearSanctionDeadline,
  checkFailureToServe,
} from './failure-to-serve'
import { aggregateCrewRatings } from '@/engine/staff/pit-crew'
import type { PitCrewChief, PitCrewMember } from '@/types/staff'
import { pickRadioMessage, isBroadcastWorthy, type RadioContext } from './radio-picker'
import { advanceRaceFlags, DEFAULT_CAUTION_CONFIG } from './race-flags'
import {
  rollLapIncidents,
  cautionFromIncidents,
  mixSeed,
  DEFAULT_RACE_INCIDENT_CONFIG,
  type RaceIncidentConfig,
  type CautionSeverity,
} from './race-incidents'
import { evaluateTrackLimitBreach, applyTrackLimitStrike, DEFAULT_TRACK_LIMITS_CONFIG } from './track-limits'
import { evaluateRejoinCollision, DEFAULT_REJOIN_CONFIG } from './rejoin-collision'
import { evaluateFlagStateBreach, DEFAULT_FLAG_OFFENCE_CONFIG } from './flag-state-offences'
import { cornersForCircuit, DEFAULT_CORNER_PROFILE } from '@/data/corner-profiles'

export interface RaceDriver {
  id: string
  /**
   * 3-letter abbreviation (e.g. 'NOR'). Used by the radio token resolver to
   * stamp speaker names without round-tripping through the world driver list.
   * Plumbed in from `BootstrapDriverInput.shortName`.
   */
  shortName: string
  /**
   * Constructor identifier. Required by radio emit sites to compute the
   * `isPlayerTeam` flag and the team-color border on commentary entries.
   * Plumbed in from `BootstrapDriverInput.teamId`.
   */
  teamId: string
  car: CarPerformance
  attributes: DriverAttributes
  /**
   * Driver mood at race start, copied from `BootstrapDriverInput.mood`.
   * Read by `evaluateContestedEvent` to compute the frustration component
   * of fault scores. Worker-side only — not persisted, not mutated by the
   * race loop.
   */
  mood: Mood
}

export interface SimRaceState {
  currentLap: number
  totalLaps: number
  weather: { current: WeatherState; rainProbability: number; changeInLaps: number | null }
  safetyCar: RaceFlag
  /** Tier C: laps left on the active caution; 0 when green. Transient. */
  cautionLapsRemaining: number
  /**
   * Race seed sourced from the bootstrap `raceSeed`. Used by the end-of-lap
   * incident layer (IP-2) to derive a per-lap incident PRNG via
   * `mixSeed(raceSeed, currentLap)`, fully separate from the main loop rng.
   * Transient — never persisted, never enters `world`.
   */
  raceSeed: number
  /** Tier C: per-driver track-limits breach count this race. Transient. Resets per race. */
  trackLimitStrikes: Record<string, number>
  trackTemp: number
  results: LapResult[][]
  incidents: RaceIncident[]
  commentary: CommentaryEntry[]
  drivers: RaceDriver[]
  circuit: { id: string; tireWear: string; overtakingDifficulty: 'low' | 'medium' | 'high'; weatherVariability: string; compounds?: [TireCompound, TireCompound, TireCompound] }
  calibration: CalibrationProfile
  strategies: RaceStrategy[]
  tireStates: Record<string, TireState>
  positions: string[] // driver IDs in position order
  // Cumulative race time per driver. Authority for position ordering and
  // gap-to-leader: a pit stop's calibrated time loss permanently widens this
  // value, so it remains visible on every subsequent lap.
  cumulativeTimes: Record<string, number>
  pendingInvestigations: import('./penalty-engine').PendingInvestigation[]
  pendingTimePenalties: Record<string, number>
  appliedPenaltiesByDriver: Record<string, AppliedPenalty[]>
  /**
   * Tier B v2 — open service-deadlines for issued drive-through / stop-go
   * penalties. Cleared when the driver pits and the pending time penalty is
   * served, OR converted to DNF when the lap-counter exceeds the deadline.
   * Session-scoped (lives in raceRuntime), never persisted.
   */
  sanctionDeadlines: Record<string, import('@/types/pit-lane').SanctionDeadline>
  /**
   * Tier B v2 — drivers retired from the race. Keyed by driverId for O(1)
   * membership tests. JSON-safe (Record<string, true> rather than Set).
   * Lap simulation skips these drivers; their `cumulativeTimes` stay frozen
   * at the last good lap.
   */
  dnfDriverIds: Record<string, true>
  /**
   * Per-race radio bookkeeping. Each flag prevents a category of radio line
   * from firing more than the policy allows (e.g. one tire-complaint per
   * stint, one weather-transition radio per change, one final-lap line per
   * driver). All session-scoped — never persisted.
   */
  radioFlags: {
    tireComplainedThisStint: Record<string, boolean>
    weatherTransitionAnnounced: boolean
    fastestLapAnnouncedTime: number
    finalLapAnnouncedFor: Record<string, boolean>
    lightsOutAnnounced: boolean
  }
  /**
   * Player team identifier for the active save. Allows radio emit sites to
   * stamp `isPlayerTeam` on commentary without lifting back to the store.
   * Optional — undefined when running an unattended simulation (tests, AI vs
   * AI smoke runs).
   */
  playerTeamId?: string
  /**
   * Driver IDs belonging to the player's team this race. Empty for
   * unattended simulations.
   */
  playerDriverIds: string[]
  /**
   * Driver IDs flagged as championship rivals (curation-only, never authority
   * on race outcomes). Empty when not provided by the start payload.
   */
  championshipRivalIds: string[]
  /**
   * Tier B v2 — per-team pit-crew snapshot for engine reads. Populated from
   * `team.pitCrewChief` + `team.pitCrewMembers` at race-start. Empty teams
   * (no chief, no members) get a `null/[]` entry that aggregates to the
   * default 70/70/70 baseline. Session-scoped — never persisted.
   */
  teamCrews: Record<string, { chief: PitCrewChief | null; members: PitCrewMember[] }>
}

export interface RaceSetup {
  drivers: RaceDriver[]
  circuit: {
    id: string; name: string; laps: number
    tireWear: string; overtakingDifficulty: 'low' | 'medium' | 'high'
    weatherVariability: string
    compounds: [TireCompound, TireCompound, TireCompound]
  }
  strategies: RaceStrategy[]
  weather: WeatherState
  gridOrder: string[] // driver IDs in grid position order
  calibration?: CalibrationProfile
  /**
   * Optional player metadata. When provided, plumbed into `SimRaceState` so
   * radio curation (`isBroadcastWorthy`) sees the player's team / drivers /
   * rivals and admits the appropriate categories. Omitted in unattended
   * simulations (smoke tests, AI vs AI runs).
   */
  playerTeamId?: string
  playerDriverIds?: readonly string[]
  championshipRivalIds?: readonly string[]
  /** Tier B v2 — per-team pit-crew snapshot. Optional — empty map → all teams aggregate to 70/70/70. */
  teamCrews?: Record<string, { chief: PitCrewChief | null; members: PitCrewMember[] }>

  /**
   * Optional incident-layer config override. Omitted in production (worker +
   * default `simulateRace`) → `DEFAULT_RACE_INCIDENT_CONFIG`. Tests pass a
   * zero-hazard config to isolate behaviour from the additive incident layer.
   */
  incidentConfig?: RaceIncidentConfig
}

export interface LapSimResult {
  lapResults: LapResult[]
  commentary: CommentaryEntry[]
  incidents: RaceIncident[]
  /** Tier B v2 — informational pit-lane events for worker → main forwarding. */
  pitLaneEvents?: import('./pit-lane-engine').PitLaneEvent[]
}

// Command modifiers: [pace_multiplier, tire_wear_multiplier]
const COMMAND_MODIFIERS: Record<DriverCommand, [number, number]> = {
  push: [1.02, 1.3],
  standard: [1.0, 1.0],
  conserve: [0.97, 0.7],
  overtake: [1.03, 1.4],
  defend: [0.99, 1.1],
  pit: [0.95, 1.0], // slowing down to pit
}

// Standard normal sample via Box–Muller. Used to convert a calibrated Gaussian
// standard deviation into a correctly-distributed scatter value. A uniform
// sampler would understate variance by ~42% and hard-cap at ±σ, erasing the
// rare botched-stop tail that the OpenF1-derived σ is meant to represent.
//
// Shared with pit-lane FSM speed-drift sampling — see `src/engine/core/gaussian.ts`.

// ---------------------------------------------------------------------------
// Team radio emit helpers (Team Radio v1)
//
// `buildRadioRaceCtx` and `emitRadio` keep every emit site uniform: build the
// per-driver `RadioContext`, gate it through `isBroadcastWorthy`, and push the
// resolved `CommentaryEntry` into the per-lap commentary list. All randomness
// flows through the simulator's PRNG — no Math.random.
// ---------------------------------------------------------------------------

function buildRadioRaceCtx(state: SimRaceState, positions: string[]) {
  return {
    championshipRivalIds: state.championshipRivalIds,
    podiumPositions: positions.slice(0, 3),
    playerDriverIds: state.playerDriverIds,
  }
}

interface RadioEmitExtras {
  opponent?: RaceDriver
  compound?: TireCompound
  turn?: number
  gap?: number
}

function emitRadio(
  state: SimRaceState,
  commentary: CommentaryEntry[],
  positions: string[],
  rng: PRNG,
  driver: RaceDriver,
  category: RadioCategory,
  speaker: RadioSpeaker,
  extras: RadioEmitExtras = {},
): void {
  const isPlayerTeam = state.playerTeamId !== undefined && state.playerTeamId === driver.teamId
  const ctx: RadioContext = {
    category,
    speaker,
    driver: {
      id: driver.id,
      shortName: driver.shortName,
      teamId: driver.teamId,
      mood: driver.mood,
    },
    opponent: extras.opponent
      ? {
          id: extras.opponent.id,
          shortName: extras.opponent.shortName,
          teamId: extras.opponent.teamId,
          mood: extras.opponent.mood,
        }
      : undefined,
    team: { id: driver.teamId, name: driver.teamId },
    lap: state.currentLap,
    totalLaps: state.totalLaps,
    position: positions.indexOf(driver.id) + 1,
    compound: extras.compound,
    turn: extras.turn,
    gap: extras.gap,
    isPlayerTeam,
  }
  const raceCtx = buildRadioRaceCtx(state, positions)
  if (isBroadcastWorthy(category, ctx, raceCtx)) {
    commentary.push(pickRadioMessage(ctx, rng))
  }
}

function calculateBaseLapTime(driver: RaceDriver, tirePerf: number, weather: WeatherState): number {
  const { car, attributes } = driver

  // Base time from car performance (90 seconds baseline for a mid-range car)
  const carAvg = (car.downforce + car.straightSpeed + car.braking + car.cornering) / 4
  const carTime = 95 - (carAvg / 100) * 10 // 85-95s range

  // Driver contribution: pace attribute shaves time
  const driverTime = -(attributes.pace / 100) * 2 // up to -2s

  // Tire performance
  const tireTime = (1 - tirePerf) * 5 // up to +5s penalty on dead tires

  // Weather penalty
  const weatherPenalty = weather === 'wet' ? 8 : weather === 'damp' ? 3 : 0

  return carTime + driverTime + tireTime + weatherPenalty
}

export function simulateLap(state: SimRaceState, rng: PRNG, incidentConfig: RaceIncidentConfig = DEFAULT_RACE_INCIDENT_CONFIG): LapSimResult {
  const lapResults: LapResult[] = []
  const commentary: CommentaryEntry[] = []
  const incidents: RaceIncident[] = []
  const pitLaneEvents: PitLaneEvent[] = []
  // The only mid-lap → end-of-lap caution link. Set true by a major/egregious
  // unsafe rejoin (detected mid-lap); read by the end-of-lap caution arbiter.
  // Replaces the removed `seriousIncidentThisLap` (contested + dead-store rejoin).
  let cautionWorthyRejoinThisLap = false

  // Tier B v2 — failure-to-serve check at lap start. Any driver whose
  // drive-through / stop-go service-deadline lapsed before this lap began is
  // converted to DNF, with a `failure-to-serve` penalty incident emitted.
  const ftsCheck = checkFailureToServe(
    { sanctionDeadlines: state.sanctionDeadlines },
    state.currentLap,
  )
  state.sanctionDeadlines = ftsCheck.nextState.sanctionDeadlines
  for (const inc of ftsCheck.incidents) {
    incidents.push(inc)
  }
  for (const dnfId of ftsCheck.dnfDriverIds) {
    state.dnfDriverIds[dnfId] = true
    if (!state.appliedPenaltiesByDriver[dnfId]) state.appliedPenaltiesByDriver[dnfId] = []
    state.appliedPenaltiesByDriver[dnfId].push({
      offenceType: 'failure-to-serve',
      sanction: 'stop-go',
      timePenaltySeconds: 0,
      penaltyPointsIssued: 0,
      warningCounted: false,
      raceLap: state.currentLap,
    })
  }

  // Capture safety-car state at lap start so the post-lap diff can fire
  // deploy/in radios on transitions. Dormant in v1 (the simulator does not
  // currently transition `state.safetyCar`) — wired so v2 inherits it.
  const prevSafetyCar = state.safetyCar

  // Lights-out radio (lap 1 only, fires once per race for player drivers).
  if (state.currentLap === 1 && !state.radioFlags.lightsOutAnnounced) {
    state.radioFlags.lightsOutAnnounced = true
    for (const pid of state.playerDriverIds) {
      const pd = state.drivers.find(d => d.id === pid)
      if (pd) {
        emitRadio(state, commentary, state.positions, rng, pd, 'lights_out', 'engineer')
      }
    }
  }

  // Final-lap radio: player drivers + race leader, once each.
  if (state.currentLap === state.totalLaps) {
    const targets = new Set<string>([...state.playerDriverIds, state.positions[0]])
    for (const driverId of targets) {
      if (!driverId) continue
      if (state.radioFlags.finalLapAnnouncedFor[driverId]) continue
      state.radioFlags.finalLapAnnouncedFor[driverId] = true
      const d = state.drivers.find(dr => dr.id === driverId)
      if (d) {
        emitRadio(state, commentary, state.positions, rng, d, 'final_lap', 'engineer')
      }
    }
  }

  // Resolve any investigations whose decision lap has arrived.
  const { resolved, stillPending } = resolveInvestigations(state.pendingInvestigations, state.currentLap)
  state.pendingInvestigations = stillPending
  for (const inv of resolved) {
    const sanction = selectSanction(inv.severity, inv.offenceType, DEFAULT_PENALTY_CALIBRATION, rng)
    if (sanction.timePenaltySeconds > 0) {
      state.pendingTimePenalties[inv.driverId] = (state.pendingTimePenalties[inv.driverId] ?? 0) + sanction.timePenaltySeconds
    }
    // Tier B v2 — drive-through and stop-go sanctions get a 3-lap service
    // deadline. Failing to serve converts to DNF on the next lap-start check.
    if (sanction.sanction === 'drive-through' || sanction.sanction === 'stop-go') {
      const ftsState = registerSanctionDeadline(
        { sanctionDeadlines: state.sanctionDeadlines },
        inv.driverId,
        sanction.sanction,
        state.currentLap,
        DEFAULT_PENALTY_CALIBRATION.failureToServeWindowLaps,
      )
      state.sanctionDeadlines = ftsState.sanctionDeadlines
    }
    if (!state.appliedPenaltiesByDriver[inv.driverId]) state.appliedPenaltiesByDriver[inv.driverId] = []
    state.appliedPenaltiesByDriver[inv.driverId].push({
      offenceType: inv.offenceType,
      sanction: sanction.sanction,
      timePenaltySeconds: sanction.timePenaltySeconds,
      penaltyPointsIssued: sanction.penaltyPoints,
      warningCounted: sanction.warningCounted,
      raceLap: state.currentLap,
    })
    incidents.push({
      lap: state.currentLap,
      type: 'penalty-issued',
      driverIds: [inv.driverId],
      description: `${inv.driverId.toUpperCase()} penalised: ${sanction.sanction} (${inv.offenceType})`,
      investigationId: inv.id,
      sanction: sanction.sanction,
      penaltyPointsIssued: sanction.penaltyPoints,
      offenceType: inv.offenceType,
    })

    // Radio: FIA voice announces the sanction; offending driver gets a
    // frustration line (curated by the picker via maxFrustration gating).
    const offendingDriver = state.drivers.find(d => d.id === inv.driverId)
    if (offendingDriver) {
      if (sanction.sanction === '5s') {
        emitRadio(state, commentary, state.positions, rng, offendingDriver, 'penalty_5s', 'fia', {
          turn: Math.floor(rng.range(1, 16)),
        })
      } else if (sanction.sanction === 'drive-through') {
        emitRadio(state, commentary, state.positions, rng, offendingDriver, 'penalty_drive_through', 'fia')
      }
      // '10s', 'reprimand', 'fine', 'stop-go', 'grid-drop' — no FIA radio template in v1.
      // Add new RadioCategory entries and wire them here when those sanctions become broadcast-relevant.
      emitRadio(state, commentary, state.positions, rng, offendingDriver, 'driver_frustration', 'driver')
    }
  }

  const positions = [...state.positions]
  const tireCal = state.calibration.tires
  const overtakeCal = state.calibration.overtake

  // Tier B v2 — pre-pass: auto-trigger planned pit stops + collect the set of
  // drivers entering the pit lane this lap. The auto-trigger is purely
  // state-driven (no PRNG) so moving it out of the per-driver loop is safe.
  // simulatePitLane runs once for the whole lap and returns per-driver
  // addedLapTime + investigation incidents + informational events.
  //
  // Edge-case behaviour (IP-B4 audit):
  //   - DNF: drivers in `state.dnfDriverIds` are skipped; their pit lane
  //     state is never instantiated.
  //   - Safety car: a stop initiated while `state.safetyCar !== 'green'` is
  //     completed normally. Real F1 also runs pit stops under SC; the
  //     player just gains less from the timing benefit.
  //   - Rain transition: tire-swap math is compound-agnostic. Switching to
  //     intermediates / wets mid-stop is supported by `currentCommand === 'pit'`
  //     reading the next planned stop's compound.
  const pittingThisLap: PitLaneSimCarInput[] = []
  for (const driverId of positions) {
    if (state.dnfDriverIds[driverId]) continue
    const strategy = state.strategies.find(s => s.driverId === driverId)!
    const nextPlannedStop = strategy.plannedStops[0]
    if (
      nextPlannedStop !== undefined &&
      state.currentLap >= nextPlannedStop.lap &&
      strategy.currentCommand !== 'pit'
    ) {
      strategy.currentCommand = 'pit'
    }
    if (strategy.currentCommand === 'pit') {
      const driver = state.drivers.find(d => d.id === driverId)!
      // Tier B v2 — pit-crew ratings derived from the driver's team via
      // `aggregateCrewRatings`. Empty teams (no chief, no members) aggregate
      // to the 70/70/70 default-quality baseline. Player who hires a 90-rated
      // chief sees ~85+ across axes; player who hires a 40-rated chief
      // drops below baseline. AI teams sit at the baseline until IP-B4 adds
      // AI staff hiring (currently out of scope).
      const crew = state.teamCrews[driver.teamId]
      const ratings = crew
        ? aggregateCrewRatings(crew.chief, crew.members)
        : aggregateCrewRatings(null, [])
      pittingThisLap.push({
        driverId,
        carEntrySpeedKph: 220 + (driver.car.straightSpeed / 100) * 40,
        carExitSpeedKph: 220 + (driver.car.straightSpeed / 100) * 40,
        releaseRating: ratings.release,
        speedDisciplineRating: ratings.speedDiscipline,
        serviceTimeRating: ratings.serviceTime,
        driverRacecraft: driver.attributes.racecraft,
        driverExperience: driver.attributes.experience,
      })
    }
  }

  let pitLaneAddedLapTime: Record<string, number> = {}
  if (pittingThisLap.length > 0) {
    const result = simulatePitLane(
      {
        cars: pittingThisLap,
        pitLane: state.calibration.pitLane,
        pitLossMean: state.calibration.pitLoss.meanLossSeconds,
        pitLossStddev: state.calibration.pitLoss.stddevSeconds,
        calibration: DEFAULT_PENALTY_CALIBRATION,
      },
      rng,
    )
    pitLaneAddedLapTime = result.addedLapTime
    for (const ev of result.events) {
      pitLaneEvents.push(ev)
      // Tier B v2 (IP-B4) — surface pit-lane events as informational
      // commentary entries so the player sees pit-stop telemetry, not
      // just the eventual penalty outcomes. Speeding-detected events are
      // already covered by the investigation-opened incident itself; the
      // remaining three (entry / release / exit) are pure flavour.
      const driverObj = state.drivers.find((d) => d.id === ev.driverId)
      const shortName = driverObj?.shortName ?? ev.driverId.toUpperCase()
      if (ev.type === 'pitLaneEntry') {
        commentary.push({
          lap: state.currentLap,
          text: `${shortName} dives into the pit lane.`,
          severity: 'info',
          driverId: ev.driverId,
          isPlayerTeam: state.playerDriverIds.includes(ev.driverId),
        })
      } else if (ev.type === 'pitLaneExit') {
        commentary.push({
          lap: state.currentLap,
          text: `${shortName} rejoins the race after a ${ev.totalLaneSeconds.toFixed(1)}s lane time.`,
          severity: 'info',
          driverId: ev.driverId,
          isPlayerTeam: state.playerDriverIds.includes(ev.driverId),
        })
      } else if (ev.type === 'pitLaneSpeedingDetected') {
        commentary.push({
          lap: state.currentLap,
          text: `${shortName} sampled at ${ev.sampledSpeedKph.toFixed(1)} km/h in the pit lane — over the limit.`,
          severity: 'highlight',
          driverId: ev.driverId,
          isPlayerTeam: state.playerDriverIds.includes(ev.driverId),
        })
      }
    }
    // Each pit-lane investigation incident gets a real id + decideOnLap by
    // routing through openInvestigation, mirroring how the contested-overtake
    // gate creates Tier A investigations.
    for (const inc of result.incidents) {
      if (inc.type === 'investigation-opened' && inc.offenceType) {
        const inv = openInvestigation(
          inc.driverIds[0],
          'minor',
          inc.offenceType,
          state.currentLap,
          state.totalLaps,
          DEFAULT_PENALTY_CALIBRATION,
          rng,
        )
        state.pendingInvestigations.push(inv)
        incidents.push({
          ...inc,
          lap: state.currentLap,
          investigationId: inv.id,
          decideOnLap: inv.decideOnLap,
        })
      } else if (inc.type === 'penalty-issued' && inc.offenceType === 'pit-line-crossing') {
        // Tier C IP-C5 — automatic pit-line white-line crossing. No
        // investigation: the sanction is applied immediately, mirroring the
        // resolved-investigation path below (appliedPenaltiesByDriver +
        // pendingTimePenalties + drive-through/stop-go deadline registration).
        // The engine emitted this with `lap: 0` and a partial
        // `pl-<boundary>` id; finalise the real lap and the lap-encoded
        // `pl-<lap>-<driverId>-<boundary>` id here.
        const driverId = inc.driverIds[0]
        let appliedTimeSeconds = 0
        if (inc.sanction === '5s' || inc.sanction === '10s') {
          appliedTimeSeconds = DEFAULT_PENALTY_CALIBRATION.sanctionMatrix['pit-line-crossing'].minor.timePenaltySeconds
          state.pendingTimePenalties[driverId] =
            (state.pendingTimePenalties[driverId] ?? 0) + appliedTimeSeconds
        } else if (inc.sanction === 'drive-through' || inc.sanction === 'stop-go') {
          const ftsState = registerSanctionDeadline(
            { sanctionDeadlines: state.sanctionDeadlines },
            driverId,
            inc.sanction,
            state.currentLap,
            DEFAULT_PENALTY_CALIBRATION.failureToServeWindowLaps,
          )
          state.sanctionDeadlines = ftsState.sanctionDeadlines
        }
        ;(state.appliedPenaltiesByDriver[driverId] ??= []).push({
          offenceType: 'pit-line-crossing',
          sanction: inc.sanction,
          timePenaltySeconds: appliedTimeSeconds,
          penaltyPointsIssued: inc.penaltyPointsIssued,
          warningCounted: false,
          raceLap: state.currentLap,
        })
        const boundary = inc.investigationId.replace('pl-', '')
        incidents.push({
          ...inc,
          lap: state.currentLap,
          investigationId: `pl-${state.currentLap}-${driverId}-${boundary}`,
        })
      }
    }
  }

  for (let posIdx = 0; posIdx < positions.length; posIdx++) {
    const driverId = positions[posIdx]
    if (state.dnfDriverIds[driverId]) continue
    const driver = state.drivers.find(d => d.id === driverId)!
    const strategy = state.strategies.find(s => s.driverId === driverId)!
    const tire = state.tireStates[driverId]
    const tirePerf = getTirePerformance(tire, tireCal)

    // Auto-trigger has already run in the pre-pass; no per-driver duplicate.

    const [paceMod, tireMod] = COMMAND_MODIFIERS[strategy.currentCommand]

    // Base lap time
    let lapTime = calculateBaseLapTime(driver, tirePerf, state.weather.current)

    // Apply command modifier (push = faster = lower time, divide by paceMod)
    lapTime = lapTime / paceMod

    // Add randomness (±0.3s variation)
    lapTime += (rng.next() - 0.5) * 0.6

    // Experience reduces variance
    const consistencyBonus = (driver.attributes.experience / 100) * 0.1
    lapTime -= consistencyBonus

    // Sector split (rough 35/30/35 distribution)
    const s1Frac = 0.35 + (rng.next() - 0.5) * 0.02
    const s2Frac = 0.30 + (rng.next() - 0.5) * 0.02
    const s3Frac = 1 - s1Frac - s2Frac

    // Handle pit stop — swap tires to fresh compound
    let pitted = false
    if (strategy.currentCommand === 'pit') {
      const nextStop = strategy.plannedStops[0]
      const newCompound = nextStop?.compound ?? 'C2'
      // Derive label from position in circuit's compound array (hardest→softest)
      const circuitCompounds = state.circuit.compounds
      let label: 'hard' | 'medium' | 'soft' = 'medium'
      if (circuitCompounds) {
        const idx = circuitCompounds.indexOf(newCompound)
        label = idx === 0 ? 'hard' : idx === 2 ? 'soft' : 'medium'
      }
      state.tireStates[driverId] = {
        compound: newCompound,
        label,
        wear: 100,
        lapsFitted: 0,
      }
      // Tier B v2 — pit-loss is computed by `simulatePitLane` in the pre-pass
      // and looked up here per driver. Replaces the static
      // `meanLossSeconds + scatter` that was inline pre-Tier B.
      lapTime += pitLaneAddedLapTime[driverId] ?? state.calibration.pitLoss.meanLossSeconds
      // Apply any pending time penalty: served at this pit stop. Clears the
      // failure-to-serve deadline if one was open for this driver.
      const pending = state.pendingTimePenalties[driverId] ?? 0
      if (pending > 0) {
        lapTime += pending
        state.pendingTimePenalties[driverId] = 0
        const cleared = clearSanctionDeadline(
          { sanctionDeadlines: state.sanctionDeadlines },
          driverId,
        )
        state.sanctionDeadlines = cleared.sanctionDeadlines
      }
      pitted = true
      // Reset command back to standard after pitting
      strategy.currentCommand = 'standard'
      // Remove used stop
      if (strategy.plannedStops.length > 0) {
        strategy.plannedStops = strategy.plannedStops.slice(1)
      }
      // Radio: engineer "box box" call + driver pit confirm. Reset the
      // tire-complaint flag so the new stint can complain again.
      // `driver` is already resolved with ! assertion at the top of the loop; no re-lookup needed.
      emitRadio(state, commentary, positions, rng, driver, 'box_box', 'engineer', { compound: newCompound })
      emitRadio(state, commentary, positions, rng, driver, 'pit_confirm', 'driver', { compound: newCompound })
      state.radioFlags.tireComplainedThisStint[driverId] = false
    } else {
      // Degrade tires for this lap
      const newTire = degradeTire(tire, tireCal, state.trackTemp)
      // Apply extra tire wear from command
      newTire.wear = Math.max(0, newTire.wear - (tireMod - 1) * 1.5)
      state.tireStates[driverId] = newTire

      // Radio: tire complaint when wear drops below 25% (one per stint).
      if (newTire.wear < 25 && !state.radioFlags.tireComplainedThisStint[driverId]) {
        state.radioFlags.tireComplainedThisStint[driverId] = true
        emitRadio(state, commentary, positions, rng, driver, 'tire_complaint', 'driver')
      }
    }

    const currentTire = state.tireStates[driverId]

    lapResults.push({
      lap: state.currentLap,
      driverId,
      lapTime,
      sector1: lapTime * s1Frac,
      sector2: lapTime * s2Frac,
      sector3: lapTime * s3Frac,
      position: posIdx + 1,
      gapToLeader: 0, // calculated after sorting
      gapToAhead: 0,
      tire: { ...currentTire },
      pitted,
    })
  }

  // Accumulate each driver's lap time into the cumulative race clock.
  // Pit penalties, tire wear, weather, and command modifiers all land here,
  // so the cumulative delta is the single source of truth for position/gap.
  for (const result of lapResults) {
    const prior = state.cumulativeTimes[result.driverId] ?? 0
    state.cumulativeTimes[result.driverId] = prior + result.lapTime
  }

  // Adjacent-pair overtake gate. Iterates prior-order pairs: where this lap's
  // cumulative times would invert the order, roll the overtake probability to
  // decide if the swap is allowed. A failed roll (or a sub-threshold lap-time
  // delta from pure noise) is blocked by throttling the trailing driver's
  // cumulative — they were physically stuck behind. This is what preserves
  // grid order on lap 1 (no seeded offsets needed) and keeps circuit
  // difficulty / racecraft / tire delta authoritative over position changes.
  const STUCK_EPSILON = 0.001
  for (let i = 1; i < positions.length; i++) {
    const aheadId = positions[i - 1]
    const behindId = positions[i]
    // DNF drivers stay in `positions` with a frozen cumulative time but produce
    // no lap result this lap; skip any pair involving one so the `find(...)!`
    // below never dereferences `undefined`.
    if (state.dnfDriverIds[aheadId] || state.dnfDriverIds[behindId]) continue
    const cumAhead = state.cumulativeTimes[aheadId]!
    const cumBehind = state.cumulativeTimes[behindId]!
    if (cumBehind >= cumAhead) continue // no inversion, nothing to gate

    const aheadResult = lapResults.find(r => r.driverId === aheadId)!
    const behindResult = lapResults.find(r => r.driverId === behindId)!
    const lapDelta = aheadResult.lapTime - behindResult.lapTime

    // Resolve drivers and strategies once for both the overtake gate, the
    // swap-radio block, and the penalty-engine fault evaluation that follows.
    const attackerDriver = state.drivers.find(d => d.id === behindId)!
    const defenderDriver = state.drivers.find(d => d.id === aheadId)!
    const attackerStrat = state.strategies.find(s => s.driverId === behindId)!
    const defenderStrat = state.strategies.find(s => s.driverId === aheadId)!

    let allowSwap = false
    if (lapDelta > 0.15) {
      const overtakeResult = calculateOvertakeProbability({
        performanceDelta: lapDelta,
        racecraft: attackerDriver.attributes.racecraft,
        calibration: overtakeCal,
        tireDelta: state.tireStates[behindId].wear - state.tireStates[aheadId].wear,
      })
      allowSwap = rng.chance(overtakeResult.probability)
    }

    if (allowSwap) {
      positions[i - 1] = behindId
      positions[i] = aheadId
      // Radio: attacker celebration + defender frustration (gated by
      // isBroadcastWorthy — non-player swaps surface only on rivalry,
      // podium, or attacker-vs-player axes).
      emitRadio(state, commentary, positions, rng, attackerDriver, 'overtake_done', 'driver', { opponent: defenderDriver })
      emitRadio(state, commentary, positions, rng, defenderDriver, 'overtake_failed', 'driver', { opponent: attackerDriver })
    } else {
      // Block the inversion: pin trailing driver's cumulative to just behind
      // the leading driver. Preserves gap reporting without faking the lap.
      state.cumulativeTimes[behindId] = cumAhead + STUCK_EPSILON
    }

    // Penalty-engine fault evaluation. Runs on every contested pair regardless
    // of the swap outcome — failed dive bombs are more likely to cause
    // incidents than clean overtakes.
    const evaluation = evaluateContestedEvent({
      attacker: attackerDriver,
      defender: defenderDriver,
      attackerCommand: attackerStrat.currentCommand,
      defenderCommand: defenderStrat.currentCommand,
      lapDelta,
      tireDelta: state.tireStates[behindId].wear - state.tireStates[aheadId].wear,
      circuit: { overtakingDifficulty: state.circuit.overtakingDifficulty },
      // Mood is piped through BootstrapDriverInput → RaceDriver, so the
      // frustration term in the fault formula now reflects real driver state.
      attackerMood: { frustration: attackerDriver.mood.frustration, confidence: attackerDriver.mood.confidence },
      defenderMood: { frustration: defenderDriver.mood.frustration, confidence: defenderDriver.mood.confidence },
      calibration: DEFAULT_PENALTY_CALIBRATION,
    }, rng)
    if (evaluation.decision) {
      const inv = openInvestigation(
        evaluation.decision.driverId,
        evaluation.decision.severity,
        evaluation.decision.offenceType,
        state.currentLap,
        state.totalLaps,
        DEFAULT_PENALTY_CALIBRATION,
        rng,
      )
      state.pendingInvestigations.push(inv)
      incidents.push({
        lap: state.currentLap,
        type: 'investigation-opened',
        driverIds: [evaluation.decision.driverId],
        description: `${evaluation.decision.driverId.toUpperCase()} under investigation: ${evaluation.decision.offenceType}`,
        investigationId: inv.id,
        offenceType: evaluation.decision.offenceType,
        decideOnLap: inv.decideOnLap,
      })

      // Radio: FIA voice opens an investigation. `turn` is synthesised from
      // PRNG since the simulator does not yet model corner numbers; templates
      // referencing {turn} resolve cleanly.
      const offenderId = evaluation.decision.driverId
      const offendingDriver = state.drivers.find(d => d.id === offenderId)
      if (offendingDriver) {
        emitRadio(state, commentary, positions, rng, offendingDriver, 'investigation', 'fia', {
          turn: Math.floor(rng.range(1, 16)),
        })
      }
    }
  }

  // Write positions + cumulative-time-based gaps back into the lap results.
  const leaderCumulative = state.cumulativeTimes[positions[0]]!
  for (let i = 0; i < positions.length; i++) {
    const driverId = positions[i]
    // DNF drivers have no lap result this lap; their cumulative is frozen and
    // their final standing was written on the lap they retired. Skip them.
    if (state.dnfDriverIds[driverId]) continue
    const result = lapResults.find(r => r.driverId === driverId)!
    result.position = i + 1
    result.gapToLeader = state.cumulativeTimes[driverId]! - leaderCumulative
    result.gapToAhead = i === 0
      ? 0
      : state.cumulativeTimes[driverId]! - state.cumulativeTimes[positions[i - 1]]!
  }

  state.positions = positions

  // Fastest-lap radio: scan this lap's results for any time strictly faster
  // than the running session-best, then emit once.
  let fastestThisLap = { driverId: '', time: Infinity }
  for (const r of lapResults) {
    if (r.lapTime < fastestThisLap.time) {
      fastestThisLap = { driverId: r.driverId, time: r.lapTime }
    }
  }
  if (fastestThisLap.time < state.radioFlags.fastestLapAnnouncedTime) {
    state.radioFlags.fastestLapAnnouncedTime = fastestThisLap.time
    const flDriver = state.drivers.find(d => d.id === fastestThisLap.driverId)
    if (flDriver) {
      emitRadio(state, commentary, positions, rng, flDriver, 'fastest_lap', 'engineer')
    }
  }

  // Rain-incoming radio: fired once per wet-transition, emitted to the
  // player team only. Resets when weather returns to dry so a later squall
  // can re-trigger.
  if (state.weather.rainProbability >= 0.7 && !state.radioFlags.weatherTransitionAnnounced) {
    state.radioFlags.weatherTransitionAnnounced = true
    for (const pid of state.playerDriverIds) {
      const pd = state.drivers.find(d => d.id === pid)
      if (pd) {
        emitRadio(state, commentary, positions, rng, pd, 'rain_incoming', 'engineer')
      }
    }
  }
  if (state.weather.current === 'dry') {
    state.radioFlags.weatherTransitionAnnounced = false
  }

  // Tier C: track-limits breaches. End-of-lap so existing within-lap PRNG draws
  // (overtakes, lap times) are unshifted. Iterate drivers in sorted id order and
  // corners in profile order for deterministic PRNG consumption.
  const cornerProfile = cornersForCircuit(state.circuit.id, DEFAULT_CORNER_PROFILE)
  const monitored = cornerProfile.corners.filter((c) => c.trackLimitMonitored)
  if (monitored.length > 0) {
    const sortedDrivers = [...state.drivers].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    for (const driver of sortedDrivers) {
      if (state.dnfDriverIds[driver.id]) continue
      for (const corner of monitored) {
        const breached = evaluateTrackLimitBreach(
          {
            difficultyTier: corner.difficultyTier,
            experience: driver.attributes.experience,
            frustration: driver.mood.frustration,
            config: DEFAULT_TRACK_LIMITS_CONFIG,
          },
          rng,
        )
        if (!breached) continue
        const prior = state.trackLimitStrikes[driver.id] ?? 0
        const strike = applyTrackLimitStrike(prior, DEFAULT_TRACK_LIMITS_CONFIG)
        state.trackLimitStrikes[driver.id] = strike.strikes
        if (strike.outcome === 'time-penalty') {
          state.pendingTimePenalties[driver.id] = (state.pendingTimePenalties[driver.id] ?? 0) + strike.timePenaltySeconds
          ;(state.appliedPenaltiesByDriver[driver.id] ??= []).push({
            offenceType: 'track-limits',
            sanction: '5s',
            timePenaltySeconds: strike.timePenaltySeconds,
            penaltyPointsIssued: 0,
            warningCounted: false,
            raceLap: state.currentLap,
          })
          incidents.push({
            lap: state.currentLap,
            type: 'penalty-issued',
            driverIds: [driver.id],
            description: `${driver.id.toUpperCase()} +5s — track limits (strike ${strike.strikes})`,
            investigationId: `tl-${state.currentLap}-${driver.id}`,
            sanction: '5s',
            penaltyPointsIssued: 0,
            offenceType: 'track-limits',
          })
        } else if (strike.outcome === 'black-and-white') {
          commentary.push({
            lap: state.currentLap,
            text: `${driver.id.toUpperCase()} shown the black-and-white flag for track limits`,
            severity: 'info',
            driverId: driver.id,
          })
        }

        // Tier C IP-C3: a car that ran wide at a med/high-rejoinRisk corner is
        // the car that rejoins; roll for an unsafe-rejoin collision. Conditional
        // on the breach already firing and the corner being risky, so the common
        // path (no breach) consumes no extra PRNG draws — determinism preserved.
        if (corner.rejoinRisk === 'med' || corner.rejoinRisk === 'high') {
          const rejoin = evaluateRejoinCollision(
            {
              driverId: driver.id,
              rejoinRisk: corner.rejoinRisk,
              racecraft: driver.attributes.racecraft,
              config: DEFAULT_REJOIN_CONFIG,
            },
            rng,
          )
          if (rejoin.decision) {
            const inv = openInvestigation(
              rejoin.decision.driverId,
              rejoin.decision.severity,
              rejoin.decision.offenceType,
              state.currentLap,
              state.totalLaps,
              DEFAULT_PENALTY_CALIBRATION,
              rng,
            )
            state.pendingInvestigations.push(inv)
            incidents.push({
              lap: state.currentLap,
              type: 'investigation-opened',
              driverIds: [rejoin.decision.driverId],
              description: `${driver.id.toUpperCase()} under investigation: unsafe rejoin (${corner.name})`,
              investigationId: inv.id,
              offenceType: rejoin.decision.offenceType,
              decideOnLap: inv.decideOnLap,
            })
            if (rejoin.decision.severity === 'major' || rejoin.decision.severity === 'egregious') {
              // Now actually read at end-of-lap by the caution arbiter (was a
              // dead store — set after advanceRaceFlags had already run).
              cautionWorthyRejoinThisLap = true
            }
          }
        }
      }
    }
  }

  // Tier C IP-C4: flag-state offences. Only runs while a caution is active, so
  // green-flag laps (the vast majority) consume ZERO extra PRNG draws and prior
  // seeded tests stay byte-identical. Aggressive drivers under caution risk a
  // breach; the detector draws no PRNG for non-aggressive drivers. id-sorted for
  // deterministic PRNG consumption. Placed AFTER advanceRaceFlags so
  // state.safetyCar reflects this lap's caution.
  if (state.safetyCar !== 'green') {
    const flag = state.safetyCar as 'yellow' | 'vsc' | 'sc' | 'red'
    const sorted = [...state.drivers].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    for (const driver of sorted) {
      if (state.dnfDriverIds[driver.id]) continue
      const cmd = state.strategies.find((s) => s.driverId === driver.id)?.currentCommand
      const aggressive = cmd === 'overtake' || cmd === 'push'
      const evalResult = evaluateFlagStateBreach(
        {
          driverId: driver.id,
          flag,
          aggressive,
          experience: driver.attributes.experience,
          mentality: driver.attributes.mentality,
          config: DEFAULT_FLAG_OFFENCE_CONFIG,
        },
        rng,
      )
      if (!evalResult.decision) continue
      const dec = evalResult.decision
      if (evalResult.automatic) {
        // VSC-delta: automatic sanction via the matrix, applied directly.
        // Mirrors the track-limits time-penalty branch above.
        const cell = DEFAULT_PENALTY_CALIBRATION.sanctionMatrix[dec.offenceType][dec.severity]
        if (cell.timePenaltySeconds > 0) {
          state.pendingTimePenalties[driver.id] =
            (state.pendingTimePenalties[driver.id] ?? 0) + cell.timePenaltySeconds
        }
        ;(state.appliedPenaltiesByDriver[driver.id] ??= []).push({
          offenceType: dec.offenceType,
          sanction: cell.sanction,
          timePenaltySeconds: cell.timePenaltySeconds,
          penaltyPointsIssued: cell.penaltyPoints,
          warningCounted: cell.warningCounted,
          raceLap: state.currentLap,
        })
        incidents.push({
          lap: state.currentLap,
          type: 'penalty-issued',
          driverIds: [driver.id],
          description: `${driver.id.toUpperCase()} ${cell.sanction} — VSC delta breach`,
          investigationId: `vsc-${state.currentLap}-${driver.id}`,
          sanction: cell.sanction,
          penaltyPointsIssued: cell.penaltyPoints,
          offenceType: dec.offenceType,
        })
      } else {
        // yellow/sc/red: open an investigation (judgment). Same signature as
        // the contested-overtake and rejoin-collision paths above.
        const inv = openInvestigation(
          dec.driverId,
          dec.severity,
          dec.offenceType,
          state.currentLap,
          state.totalLaps,
          DEFAULT_PENALTY_CALIBRATION,
          rng,
        )
        state.pendingInvestigations.push(inv)
        incidents.push({
          lap: state.currentLap,
          type: 'investigation-opened',
          driverIds: [dec.driverId],
          description: `${driver.id.toUpperCase()} under investigation: ${dec.offenceType}`,
          investigationId: inv.id,
          offenceType: dec.offenceType,
          decideOnLap: inv.decideOnLap,
        })
      }
    }
  }

  // ── Race-incident layer (end-of-lap, on a SEPARATE per-lap PRNG) ──────────
  // Derived from (raceSeed, currentLap) so it consumes ZERO draws from the main
  // loop rng — the existing seeded simulation stays byte-identical.
  const incidentRng = createPRNG(mixSeed(state.raceSeed, state.currentLap))
  const incidentDrivers = state.drivers.map((d) => ({
    id: d.id,
    racecraft: d.attributes.racecraft,
    experience: d.attributes.experience,
    frustration: d.mood.frustration,
    reliability: d.car.reliability,
  }))
  const rolls = rollLapIncidents(
    {
      drivers: incidentDrivers,
      dnfDriverIds: state.dnfDriverIds,
      currentLap: state.currentLap,
      totalLaps: state.totalLaps,
      wet: state.weather.current !== 'dry',
      circuitRiskFactor: 1,
      config: incidentConfig,
    },
    incidentRng,
  )
  for (const roll of rolls) {
    if (roll.retired) state.dnfDriverIds[roll.driverId] = true
    if (roll.kind === 'crash') {
      incidents.push({ lap: state.currentLap, type: 'crash', driverIds: [roll.driverId], description: `${roll.driverId.toUpperCase()} crashes out of the race` })
      commentary.push({ lap: state.currentLap, text: `${roll.driverId.toUpperCase()} crashes — out of the race`, severity: 'critical', driverId: roll.driverId })
    } else {
      incidents.push({ lap: state.currentLap, type: 'mechanical', driverIds: [roll.driverId], description: `${roll.driverId.toUpperCase()} retires — mechanical failure` })
      commentary.push({ lap: state.currentLap, text: `${roll.driverId.toUpperCase()} stops — mechanical failure`, severity: 'info', driverId: roll.driverId })
    }
  }

  // Caution arbiter: worst incident severity OR'd with the rejoin contribution
  // (a major/egregious unsafe rejoin → a 'minor' caution: a collision is a
  // VSC/yellow, not a heavy-shunt SC).
  const incidentSeverity = cautionFromIncidents(rolls)
  // A major/egregious unsafe rejoin contributes only a 'minor' caution (a
  // collision is a VSC/yellow, never a heavy-shunt SC) — so only the incident
  // layer can raise a 'major' trigger.
  const rejoinSeverity: CautionSeverity | null = cautionWorthyRejoinThisLap ? 'minor' : null
  const cautionTrigger: CautionSeverity | null =
    incidentSeverity === 'major'
      ? 'major'
      : incidentSeverity === 'minor' || rejoinSeverity === 'minor'
        ? 'minor'
        : null

  // Advance the caution FSM on the incident PRNG (cause-biased flag selection).
  const flagTransition = advanceRaceFlags(
    { safetyCar: state.safetyCar, cautionLapsRemaining: state.cautionLapsRemaining },
    incidentRng,
    cautionTrigger,
    DEFAULT_CAUTION_CONFIG,
  )
  state.safetyCar = flagTransition.safetyCar
  state.cautionLapsRemaining = flagTransition.cautionLapsRemaining
  if (flagTransition.deployed !== null) {
    incidents.push({ lap: state.currentLap, type: 'safety-car', driverIds: [], description: `${flagTransition.deployed.toUpperCase()} deployed` })
  }
  // SC deploy/clear radio diff vs the lap-start flag captured in prevSafetyCar.
  if (state.safetyCar !== 'green' && prevSafetyCar === 'green') {
    for (const d of state.drivers) emitRadio(state, commentary, positions, rng, d, 'safety_car_deploy', 'fia')
  }
  if (state.safetyCar === 'green' && prevSafetyCar !== 'green') {
    for (const d of state.drivers) emitRadio(state, commentary, positions, rng, d, 'safety_car_in', 'fia')
  }

  return { lapResults, commentary, incidents, pitLaneEvents }
}

export interface RaceResult {
  finalPositions: string[]
  lapData: LapResult[][]
  commentary: CommentaryEntry[]
  incidents: RaceIncident[]
  fastestLap: { driverId: string; time: number }
}

export function simulateRace(setup: RaceSetup, seed: number): RaceResult {
  const rng = createPRNG(seed)
  const calibration = setup.calibration ?? resolveCalibrationForCircuit({
    id: setup.circuit.id,
    name: setup.circuit.name,
    country: '',
    laps: setup.circuit.laps,
    downforceLevel: 'medium',
    tireWear: setup.circuit.tireWear as 'low' | 'medium' | 'high',
    overtakingDifficulty: setup.circuit.overtakingDifficulty,
    weatherVariability: setup.circuit.weatherVariability as 'low' | 'medium' | 'high',
    sectorCount: 3,
    compounds: setup.circuit.compounds,
  })
  const weatherEngine = new WeatherEngine(setup.weather, calibration.weather, createPRNG(seed + 1))

  // Initialize tire states (start on first compound in strategy)
  const tireStates: Record<string, TireState> = {}
  for (const strategy of setup.strategies) {
    const compound = strategy.plannedStops.length > 0
      ? setup.circuit.compounds[2] // start on softest available
      : setup.circuit.compounds[1]
    tireStates[strategy.driverId] = {
      compound,
      label: 'medium',
      wear: 100,
      lapsFitted: 0,
    }
  }

  const state: SimRaceState = {
    currentLap: 0,
    totalLaps: setup.circuit.laps,
    weather: weatherEngine.getForecast(setup.circuit.laps),
    safetyCar: 'green',
    cautionLapsRemaining: 0,
    raceSeed: seed,
    trackLimitStrikes: {},
    trackTemp: 35 + rng.range(-5, 10),
    results: [],
    incidents: [],
    commentary: [],
    drivers: setup.drivers,
    circuit: setup.circuit,
    calibration,
    strategies: setup.strategies.map(s => ({ ...s })),
    tireStates,
    positions: setup.gridOrder || setup.drivers.map(d => d.id),
    cumulativeTimes: Object.fromEntries(setup.drivers.map(d => [d.id, 0])),
    pendingInvestigations: [],
    pendingTimePenalties: {},
    appliedPenaltiesByDriver: {},
    sanctionDeadlines: {},
    dnfDriverIds: {},
    radioFlags: {
      tireComplainedThisStint: {},
      weatherTransitionAnnounced: false,
      fastestLapAnnouncedTime: Infinity,
      finalLapAnnouncedFor: {},
      lightsOutAnnounced: false,
    },
    playerTeamId: setup.playerTeamId,
    playerDriverIds: [...(setup.playerDriverIds ?? [])],
    championshipRivalIds: [...(setup.championshipRivalIds ?? [])],
    teamCrews: setup.teamCrews ?? {},
  }

  const allLapData: LapResult[][] = []
  const allCommentary: CommentaryEntry[] = []
  const allIncidents: RaceIncident[] = []
  let fastestLap = { driverId: '', time: Infinity }

  for (let lap = 1; lap <= setup.circuit.laps; lap++) {
    state.currentLap = lap
    weatherEngine.tick()
    state.weather = weatherEngine.getForecast(setup.circuit.laps - lap)

    const { lapResults, commentary, incidents } = simulateLap(state, rng, setup.incidentConfig ?? DEFAULT_RACE_INCIDENT_CONFIG)

    allLapData.push(lapResults)
    allCommentary.push(...commentary)
    allIncidents.push(...incidents)

    // Track fastest lap
    for (const result of lapResults) {
      if (result.lapTime < fastestLap.time) {
        fastestLap = { driverId: result.driverId, time: result.lapTime }
      }
    }
  }

  // Race-end fold: penalty fold + position re-sort + final-lap position rewrite.
  // Shared with the worker path via `applyRaceEndFold` so the two call sites
  // cannot drift.
  applyRaceEndFold(state, allLapData[allLapData.length - 1])

  return {
    finalPositions: [...state.positions],
    lapData: allLapData,
    commentary: allCommentary,
    incidents: allIncidents,
    fastestLap,
  }
}

/**
 * Race-end fold: applies any residual pendingTimePenalties to cumulative
 * times, re-sorts positions by cumulative time, and rewrites the final-lap
 * LapResult.position values so consumers see post-penalty ordering.
 *
 * Called from both `simulateRace` (the in-process path used by tests) and
 * `simulateNextLap` in the worker (production path). Keep the two call
 * sites identical by going through this helper.
 *
 * @param state - the SimRaceState (mutated in place)
 * @param finalLapResults - the last lap's LapResult array (mutated in place)
 */
export function applyRaceEndFold(
  state: SimRaceState,
  finalLapResults: LapResult[] | undefined,
): void {
  // Penalty fold
  for (const driverId of Object.keys(state.pendingTimePenalties)) {
    const seconds = state.pendingTimePenalties[driverId]
    if (seconds > 0) {
      state.cumulativeTimes[driverId] = (state.cumulativeTimes[driverId] ?? 0) + seconds
      state.pendingTimePenalties[driverId] = 0
    }
  }

  // Position re-sort by cumulative time
  const newPositions = [...state.positions].sort(
    (a, b) => (state.cumulativeTimes[a] ?? 0) - (state.cumulativeTimes[b] ?? 0),
  )
  state.positions = newPositions

  // Rewrite final-lap position so emitted data reflects post-penalty grid
  if (finalLapResults) {
    for (let i = 0; i < newPositions.length; i++) {
      const driverId = newPositions[i]
      const lr = finalLapResults.find((r) => r.driverId === driverId)
      if (lr) lr.position = i + 1
    }
  }
}
