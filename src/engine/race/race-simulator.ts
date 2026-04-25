import type { CarPerformance } from '@/types/team'
import type { DriverAttributes, Mood } from '@/types/driver'
import type {
  TireCompound, TireState, LapResult, RaceStrategy,
  DriverCommand, CommentaryEntry, RaceIncident, WeatherState, AppliedPenalty,
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

export interface RaceDriver {
  id: string
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
  safetyCar: 'green' | 'vsc' | 'sc'
  trackTemp: number
  results: LapResult[][]
  incidents: RaceIncident[]
  commentary: CommentaryEntry[]
  drivers: RaceDriver[]
  circuit: { tireWear: string; overtakingDifficulty: 'low' | 'medium' | 'high'; weatherVariability: string; compounds?: [TireCompound, TireCompound, TireCompound] }
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
}

export interface LapSimResult {
  lapResults: LapResult[]
  commentary: CommentaryEntry[]
  incidents: RaceIncident[]
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
function sampleGaussian(rng: PRNG): number {
  const u1 = Math.max(rng.next(), 1e-9) // avoid log(0)
  const u2 = rng.next()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
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

export function simulateLap(state: SimRaceState, rng: PRNG): LapSimResult {
  const lapResults: LapResult[] = []
  const commentary: CommentaryEntry[] = []
  const incidents: RaceIncident[] = []

  // Resolve any investigations whose decision lap has arrived.
  const { resolved, stillPending } = resolveInvestigations(state.pendingInvestigations, state.currentLap)
  state.pendingInvestigations = stillPending
  for (const inv of resolved) {
    const sanction = selectSanction(inv.severity, inv.offenceType, DEFAULT_PENALTY_CALIBRATION, rng)
    if (sanction.timePenaltySeconds > 0) {
      state.pendingTimePenalties[inv.driverId] = (state.pendingTimePenalties[inv.driverId] ?? 0) + sanction.timePenaltySeconds
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
  }

  const positions = [...state.positions]
  const tireCal = state.calibration.tires
  const overtakeCal = state.calibration.overtake

  for (let posIdx = 0; posIdx < positions.length; posIdx++) {
    const driverId = positions[posIdx]
    const driver = state.drivers.find(d => d.id === driverId)!
    const strategy = state.strategies.find(s => s.driverId === driverId)!
    const tire = state.tireStates[driverId]
    const tirePerf = getTirePerformance(tire, tireCal)

    // Auto-trigger planned pit stop when the current lap reaches the next scheduled stop.
    // Deterministic — driven purely by state, no PRNG involved.
    const nextPlannedStop = strategy.plannedStops[0]
    if (
      nextPlannedStop !== undefined &&
      state.currentLap >= nextPlannedStop.lap &&
      strategy.currentCommand !== 'pit'
    ) {
      strategy.currentCommand = 'pit'
    }

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
      const pitLoss = state.calibration.pitLoss
      let scatter = 0
      if (pitLoss.stddevSeconds > 0) {
        // Clamp to ±3σ so simulator output stays bounded; 99.7% of the true
        // Gaussian mass is already inside that window.
        const z = Math.max(-3, Math.min(3, sampleGaussian(rng)))
        scatter = z * pitLoss.stddevSeconds
      }
      lapTime += pitLoss.meanLossSeconds + scatter
      // Apply any pending time penalty: served at this pit stop.
      const pending = state.pendingTimePenalties[driverId] ?? 0
      if (pending > 0) {
        lapTime += pending
        state.pendingTimePenalties[driverId] = 0
      }
      pitted = true
      // Reset command back to standard after pitting
      strategy.currentCommand = 'standard'
      // Remove used stop
      if (strategy.plannedStops.length > 0) {
        strategy.plannedStops = strategy.plannedStops.slice(1)
      }
      commentary.push({
        lap: state.currentLap,
        text: `${driverId.toUpperCase()} pits for ${newCompound} tires`,
        severity: 'highlight',
      })
    } else {
      // Degrade tires for this lap
      const newTire = degradeTire(tire, tireCal, state.trackTemp)
      // Apply extra tire wear from command
      newTire.wear = Math.max(0, newTire.wear - (tireMod - 1) * 1.5)
      state.tireStates[driverId] = newTire
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
    const cumAhead = state.cumulativeTimes[aheadId]!
    const cumBehind = state.cumulativeTimes[behindId]!
    if (cumBehind >= cumAhead) continue // no inversion, nothing to gate

    const aheadResult = lapResults.find(r => r.driverId === aheadId)!
    const behindResult = lapResults.find(r => r.driverId === behindId)!
    const lapDelta = aheadResult.lapTime - behindResult.lapTime

    let allowSwap = false
    if (lapDelta > 0.15) {
      const behindDriver = state.drivers.find(d => d.id === behindId)!
      const overtakeResult = calculateOvertakeProbability({
        performanceDelta: lapDelta,
        racecraft: behindDriver.attributes.racecraft,
        calibration: overtakeCal,
        tireDelta: state.tireStates[behindId].wear - state.tireStates[aheadId].wear,
      })
      allowSwap = rng.chance(overtakeResult.probability)
    }

    if (allowSwap) {
      positions[i - 1] = behindId
      positions[i] = aheadId
      commentary.push({
        lap: state.currentLap,
        text: `${behindId.toUpperCase()} overtakes ${aheadId.toUpperCase()}!`,
        severity: 'highlight',
      })
    } else {
      // Block the inversion: pin trailing driver's cumulative to just behind
      // the leading driver. Preserves gap reporting without faking the lap.
      state.cumulativeTimes[behindId] = cumAhead + STUCK_EPSILON
    }

    // Penalty-engine fault evaluation. Runs on every contested pair regardless
    // of the swap outcome — failed dive bombs are more likely to cause
    // incidents than clean overtakes.
    const aheadDriver = state.drivers.find((d) => d.id === aheadId)!
    const behindDriver2 = state.drivers.find((d) => d.id === behindId)!
    const aheadStrat = state.strategies.find((s) => s.driverId === aheadId)!
    const behindStrat = state.strategies.find((s) => s.driverId === behindId)!
    const evaluation = evaluateContestedEvent({
      attacker: behindDriver2,
      defender: aheadDriver,
      attackerCommand: behindStrat.currentCommand,
      defenderCommand: aheadStrat.currentCommand,
      lapDelta,
      tireDelta: state.tireStates[behindId].wear - state.tireStates[aheadId].wear,
      circuit: { overtakingDifficulty: state.circuit.overtakingDifficulty },
      // Mood is piped through BootstrapDriverInput → RaceDriver, so the
      // frustration term in the fault formula now reflects real driver state.
      attackerMood: { frustration: behindDriver2.mood.frustration, confidence: behindDriver2.mood.confidence },
      defenderMood: { frustration: aheadDriver.mood.frustration, confidence: aheadDriver.mood.confidence },
      calibration: DEFAULT_PENALTY_CALIBRATION,
    }, rng)
    if (evaluation.decision) {
      const inv = openInvestigation(
        evaluation.decision.driverId,
        evaluation.decision.severity,
        evaluation.decision.offenceType,
        state.currentLap,
        state.totalLaps,
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
    }
  }

  // Write positions + cumulative-time-based gaps back into the lap results.
  const leaderCumulative = state.cumulativeTimes[positions[0]]!
  for (let i = 0; i < positions.length; i++) {
    const driverId = positions[i]
    const result = lapResults.find(r => r.driverId === driverId)!
    result.position = i + 1
    result.gapToLeader = state.cumulativeTimes[driverId]! - leaderCumulative
    result.gapToAhead = i === 0
      ? 0
      : state.cumulativeTimes[driverId]! - state.cumulativeTimes[positions[i - 1]]!
  }

  state.positions = positions

  return { lapResults, commentary, incidents }
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
  }

  const allLapData: LapResult[][] = []
  const allCommentary: CommentaryEntry[] = []
  const allIncidents: RaceIncident[] = []
  let fastestLap = { driverId: '', time: Infinity }

  for (let lap = 1; lap <= setup.circuit.laps; lap++) {
    state.currentLap = lap
    weatherEngine.tick()
    state.weather = weatherEngine.getForecast(setup.circuit.laps - lap)

    const { lapResults, commentary, incidents } = simulateLap(state, rng)

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

  // Race-end fold: any pendingTimePenalties not yet served at a pit stop
  // are added to cumulative time on the final lap. Re-sort positions and
  // rewrite the final-lap LapResult.position values so the emitted data
  // reflects post-penalty ordering.
  for (const driverId of Object.keys(state.pendingTimePenalties)) {
    const seconds = state.pendingTimePenalties[driverId]
    if (seconds > 0) {
      state.cumulativeTimes[driverId] = (state.cumulativeTimes[driverId] ?? 0) + seconds
      state.pendingTimePenalties[driverId] = 0
    }
  }
  const newPositions = [...state.positions].sort(
    (a, b) => (state.cumulativeTimes[a] ?? 0) - (state.cumulativeTimes[b] ?? 0),
  )
  state.positions = newPositions

  // Rewrite final-lap LapResult.position so consumers reading it see the
  // post-penalty grid. Earlier laps stay as historical data.
  const finalLapResults = allLapData[allLapData.length - 1]
  if (finalLapResults) {
    for (let i = 0; i < newPositions.length; i++) {
      const driverId = newPositions[i]
      const lr = finalLapResults.find((r) => r.driverId === driverId)
      if (lr) lr.position = i + 1
    }
  }

  return {
    finalPositions: [...state.positions],
    lapData: allLapData,
    commentary: allCommentary,
    incidents: allIncidents,
    fastestLap,
  }
}
