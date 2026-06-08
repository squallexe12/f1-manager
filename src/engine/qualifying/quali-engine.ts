import type { BootstrapDriverInput, Circuit, TireCompound, WeatherState } from '@/types/race'
import type { PRNG } from '@/engine/core/prng'
import { createPRNG } from '@/engine/core/prng'
import { deriveRaceSeed } from '@/engine/race/race-bootstrap'
import { deriveSessionSeed } from '@/engine/weekend/seed-derivation'
import { NEUTRAL_AI_SETUP } from '@/engine/practice/practice-engine'
import { calculateQualiLapTime, resolveTireLabel, selectAICompound } from './quali-lap-model'
import type {
  DriverWeekendSetup,
  QualiDriverResult,
  QualiFormat,
  QualiSegment,
  QualiSegmentResult,
  QualifyingResult,
  WeekendTireLedger,
} from '@/types/weekend'

/**
 * Knockout qualifying engine (plan §M2). Pure + synchronous: ~26 driver-runs
 * (~2 PRNG draws each) resolve in well under 5ms — no Web Worker. The "live"
 * feel is a client-side timed reveal of these pre-computed results (M7). Every
 * segment runs on its OWN salted PRNG stream, so eliminating a car in Q1 can
 * never shift Q3. Each driver consumes a FIXED 2 draws (traffic + hot-lap),
 * phantom on abort, so a player command never moves a rival's outcome.
 */

export const SEGMENTS: Record<QualiFormat, Array<{ segment: QualiSegment; advancing: number }>> = {
  qualifying: [
    { segment: 'Q1', advancing: 15 },
    { segment: 'Q2', advancing: 10 },
    { segment: 'Q3', advancing: 10 },
  ],
  'sprint-qualifying': [
    { segment: 'SQ1', advancing: 15 },
    { segment: 'SQ2', advancing: 10 },
    { segment: 'SQ3', advancing: 10 },
  ],
}

const QUALI_SET_COST = 1 // one tire set per qualifying run
const FINAL_SEGMENTS: ReadonlySet<QualiSegment> = new Set<QualiSegment>(['Q3', 'SQ3'])

/**
 * Pure. Simulate ONE segment over its entrants (in classified order from the
 * prior segment). Decrements the ledger for player runs only; AI runs at the
 * neutral baseline and never touches the player ledger (ADR-PQ-004).
 */
export function simulateQualifyingSegment(args: {
  segment: QualiSegment
  entrants: string[]
  advancingCount: number
  drivers: BootstrapDriverInput[]
  circuitCompounds: readonly TireCompound[]
  weather: WeatherState
  setup: Record<string, DriverWeekendSetup>
  playerDriverIds: Set<string>
  playerCommands: Map<string, { compound: TireCompound; aborted: boolean }>
  ledger: WeekendTireLedger
  prng: PRNG
}): { result: QualiSegmentResult; nextLedger: WeekendTireLedger } {
  const {
    segment, entrants, advancingCount, drivers, circuitCompounds, weather,
    setup, playerDriverIds, playerCommands, ledger, prng,
  } = args
  const isFinal = FINAL_SEGMENTS.has(segment)
  const byId = new Map(drivers.map((d) => [d.id, d]))
  const workingLedger: WeekendTireLedger = { remaining: { ...ledger.remaining } }
  const entryOrder = new Map(entrants.map((id, i) => [id, i]))

  const results: QualiDriverResult[] = []
  for (const id of entrants) {
    const d = byId.get(id)
    const isPlayer = playerDriverIds.has(id)
    const cmd = isPlayer ? playerCommands.get(id) : undefined
    const aborted = cmd?.aborted ?? false
    const compound: TireCompound = isPlayer
      ? cmd?.compound ?? circuitCompounds[2] // player auto-run defaults to soft
      : selectAICompound(circuitCompounds, isFinal)

    if (!d || aborted) {
      // Phantom 2 draws preserve stream parity (FIXED-DRAW discipline).
      prng.next()
      prng.next()
      results.push({
        driverId: id,
        bestLapTime: null,
        attempts: [{ driverId: id, compound, lapTime: null, sector1: null, sector2: null, sector3: null, aborted: true, lapDeleted: false }],
        eliminated: false,
        segmentPosition: 0,
      })
      continue
    }

    prng.next() // draw 1: traffic (calculateQualiLapTime consumes draw 2)
    const setupConfidence = isPlayer ? (setup[id]?.setupConfidence ?? 50) : NEUTRAL_AI_SETUP
    const tireLabel = resolveTireLabel(compound, circuitCompounds)
    const { lapTime } = calculateQualiLapTime({ car: d.car, attributes: d.attributes, compound, tireLabel, setupConfidence, weather, prng })
    const sector1 = lapTime * 0.32
    const sector2 = lapTime * 0.36
    const sector3 = lapTime - sector1 - sector2

    if (isPlayer) {
      workingLedger.remaining[compound] = Math.max(0, (workingLedger.remaining[compound] ?? 0) - QUALI_SET_COST)
    }
    results.push({
      driverId: id,
      bestLapTime: lapTime,
      attempts: [{ driverId: id, compound, lapTime, sector1, sector2, sector3, aborted: false, lapDeleted: false }],
      eliminated: false,
      segmentPosition: 0,
    })
  }

  // Timed laps ascending; no-time drivers to the back; ties broken by stable entry order.
  results.sort((a, b) => {
    const at = a.bestLapTime
    const bt = b.bestLapTime
    if (at === null && bt === null) return entryOrder.get(a.driverId)! - entryOrder.get(b.driverId)!
    if (at === null) return 1
    if (bt === null) return -1
    if (at !== bt) return at - bt
    return entryOrder.get(a.driverId)! - entryOrder.get(b.driverId)!
  })

  const adv = Math.min(advancingCount, results.length)
  results.forEach((r, i) => {
    r.segmentPosition = i + 1
    r.eliminated = i >= adv
  })

  return {
    result: {
      segment,
      weather,
      results,
      advancing: results.slice(0, adv).map((r) => r.driverId),
      eliminated: results.slice(adv).map((r) => r.driverId),
    },
    nextLedger: workingLedger,
  }
}

/**
 * Pure. Collate an ordered list of completed segment results into the final
 * classification: grid order (final segment on top, then each earlier segment's
 * eliminated block oldest-last), per-driver best times, pole, and the session
 * fastest lap. The single source of truth shared by the headless
 * `simulateQualifying` and the M7 live store path, which accumulates segments
 * one reveal at a time and collates them here (so the live earned grid is
 * byte-identical to a headless run on the same seed). Makes no PRNG draws.
 */
export function collateQualifyingResult(args: {
  format: QualiFormat
  round: number
  seed: number
  segmentResults: QualiSegmentResult[]
}): QualifyingResult {
  const { format, round, seed, segmentResults } = args

  const bestTimes: Record<string, number | null> = {}
  for (const seg of segmentResults) {
    for (const r of seg.results) {
      if (r.bestLapTime !== null) {
        const prev = bestTimes[r.driverId]
        bestTimes[r.driverId] = prev == null ? r.bestLapTime : Math.min(prev, r.bestLapTime)
      } else if (!(r.driverId in bestTimes)) {
        bestTimes[r.driverId] = null
      }
    }
  }

  // Grid: final-segment classification on top, then each earlier segment's
  // eliminated block (already fastest-first within the segment), oldest last.
  const finalSeg = segmentResults[segmentResults.length - 1]
  const gridOrder: string[] = finalSeg.results.map((r) => r.driverId)
  for (let i = segmentResults.length - 2; i >= 0; i--) {
    gridOrder.push(...segmentResults[i].eliminated)
  }

  const poleId = gridOrder[0] ?? ''
  const poleTime = finalSeg.results.find((r) => r.driverId === poleId)?.bestLapTime ?? null
  let fastestLap: { driverId: string; time: number } | null = null
  for (const seg of segmentResults) {
    for (const r of seg.results) {
      if (r.bestLapTime !== null && (fastestLap === null || r.bestLapTime < fastestLap.time)) {
        fastestLap = { driverId: r.driverId, time: r.bestLapTime }
      }
    }
  }

  return {
    format,
    round,
    segments: segmentResults,
    gridOrder,
    bestTimes,
    pole: { driverId: poleId, time: poleTime },
    fastestLap,
    seed,
  }
}

/**
 * Pure. Full session = 3 segments + grid collation + pole/fastest capture.
 * Used by the headless skip path and determinism tests; the live UI (M7) calls
 * simulateQualifyingSegment per segment for the timed reveal instead. ALWAYS
 * emits a complete N-entry classification (never a partial grid).
 */
export function simulateQualifying(args: {
  format: QualiFormat
  round: number
  raceSeed: number
  drivers: BootstrapDriverInput[]
  circuit: Circuit
  setup: Record<string, DriverWeekendSetup>
  weatherPerSegment?: Partial<Record<QualiSegment, WeatherState>>
  playerDriverIds?: string[]
  playerCommandsBySegment?: Map<QualiSegment, Map<string, { compound: TireCompound; aborted: boolean }>>
  ledger: WeekendTireLedger
}): { result: QualifyingResult; nextLedger: WeekendTireLedger } {
  const { format, round, raceSeed, drivers, circuit, setup, weatherPerSegment, playerDriverIds, playerCommandsBySegment, ledger } = args
  const perRoundRoot = deriveRaceSeed(raceSeed, round)
  const playerSet = new Set(playerDriverIds ?? [])

  let workingLedger: WeekendTireLedger = { remaining: { ...ledger.remaining } }
  let entrants = drivers.map((d) => d.id) // Q1/SQ1 entrants = roster order
  const segmentResults: QualiSegmentResult[] = []

  for (const def of SEGMENTS[format]) {
    const weather = weatherPerSegment?.[def.segment] ?? 'dry'
    const prng = createPRNG(deriveSessionSeed(perRoundRoot, def.segment))
    const playerCommands = playerCommandsBySegment?.get(def.segment) ?? new Map()
    const { result, nextLedger } = simulateQualifyingSegment({
      segment: def.segment,
      entrants,
      advancingCount: Math.min(def.advancing, entrants.length),
      drivers,
      circuitCompounds: circuit.compounds,
      weather,
      setup,
      playerDriverIds: playerSet,
      playerCommands,
      ledger: workingLedger,
      prng,
    })
    workingLedger = nextLedger
    segmentResults.push(result)
    entrants = result.advancing
  }

  return {
    result: collateQualifyingResult({ format, round, seed: perRoundRoot, segmentResults }),
    nextLedger: workingLedger,
  }
}
