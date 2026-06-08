'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGameStore } from '@/stores/game-store'
import type { CommentaryEntry, SimSpeed, TireCompound, WeatherState } from '@/types/race'
import type {
  QualiFormat,
  QualiSegment,
  QualiSegmentResult,
  QualiDriverResult,
  QualifyingResult,
} from '@/types/weekend'
import type { QualiSessionPhase } from '@/stores/qualifying-runtime-slice'

/**
 * Qualifying live-screen presentation adapter (plan §M7). Mirrors
 * `use-practice-session`: reads the transient `qualifyingRuntime` + the durable
 * `world.weekendState` via `useShallow`, owns the client-side reveal loop (a
 * `setInterval` that unveils each entrant's hot-lap progressively, then closes
 * the segment), and exposes thin action wrappers. No engine imports — every
 * engine call lives behind a store action (`runQualiSegment`,
 * `commitLiveQualifyingGrid`, `runQualifyingHeadless`); the reveal here is pure
 * theatre over the already-computed, deterministic segment results.
 */

/** Knockout segment table — a UI-local mirror of the engine `SEGMENTS` constant
 *  (kept local so the hook imports no engine values, per AGENTS.md). */
const QUALI_SEGMENTS: Record<QualiFormat, Array<{ segment: QualiSegment; advancing: number }>> = {
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

/** Wall-clock interval per sim speed (ms) — faster speed, snappier reveal. */
const REVEAL_INTERVAL_MS: Record<string, number> = { '1': 450, '2': 260, '5': 130, 'max': 40 }

export interface QualiTowerEntry {
  position: number
  driverId: string
  code: string
  driverName: string
  teamColor: string
  isPlayer: boolean
  bestLapTime: number | null
  /** Derived sector splits for the revealed lap (cosmetic — the engine derives
   *  them from the lap time); null until the driver's lap is revealed. */
  sectors: { s1: number; s2: number; s3: number } | null
  /** Display compound label ('SOFT' | 'MED' | 'HARD' | ''). */
  tire: string
  /** True once the segment closes and this car is knocked out (final cue). */
  eliminated: boolean
  /** Provisional drop-zone flag while the segment is live (position past the
   *  cutline). The tower draws the elimination-zone separator from this. */
  isBelowCutline: boolean
}

export interface QualiPlayerControl {
  driverId: string
  code: string
  compound: TireCompound | null
}

export interface QualiClassificationRow {
  position: number
  driverId: string
  code: string
  driverName: string
  teamColor: string
  isPlayer: boolean
  bestTime: number | null
  isPole: boolean
  isFastest: boolean
}

export interface QualifyingSessionView {
  sessionPhase: QualiSessionPhase
  simSpeed: SimSpeed
  format: QualiFormat
  isSprint: boolean
  segmentLabel: string // 'Q1'
  segmentName: string // 'Qualifying 1'
  /** Label of the NEXT segment (''when on the final one) — for the "Start Q2" CTA. */
  nextSegmentLabel: string
  segmentIndex: number // 0..2
  totalSegments: number
  segmentTimeRemaining: number
  cutlinePosition: number
  weather: WeatherState
  circuitId: string
  circuitName: string
  raceName: string
  round: number
  circuitCompounds: TireCompound[]
  setsByCompound: Partial<Record<TireCompound, number>>
  tower: QualiTowerEntry[]
  players: QualiPlayerControl[]
  commentary: CommentaryEntry[]
  classification: QualiClassificationRow[] | null
  pole: { driverId: string; code: string; time: number | null } | null
  fastest: { driverId: string; code: string; time: number } | null
  isLastSegment: boolean
  canBegin: boolean
  canSkip: boolean
}

/** Compound → display label by position in the circuit's hardest→softest set.
 *  UI-local mirror of the engine `resolveTireLabel` (uppercased for the tower). */
function compoundLabel(compound: TireCompound | null, circuitCompounds: TireCompound[]): string {
  if (!compound) return ''
  const i = circuitCompounds.indexOf(compound)
  return i === 0 ? 'HARD' : i === 2 ? 'SOFT' : 'MED'
}

export function useQualifyingSession() {
  // Transient slice — changes on every reveal tick (intended; the screen must
  // re-render to animate the clock + tower).
  const runtime = useGameStore((s) => s.qualifyingRuntime)

  // Durable bits — stable references during a session (world mutates only when a
  // segment's ledger is committed). useShallow keeps unrelated store changes
  // (e.g. raceRuntime) from re-rendering.
  const world = useGameStore(
    useShallow((s) => ({
      weekendState: s.world?.weekendState,
      gameState: s.world?.gameState,
      drivers: s.world?.drivers,
      teams: s.world?.teams,
      calendar: s.world?.calendar,
    })),
  )

  // Store actions (stable Zustand refs — selecting them never re-renders).
  const initQualiSession = useGameStore((s) => s.initQualiSession)
  const runQualiSegment = useGameStore((s) => s.runQualiSegment)
  const commitLiveQualifyingGrid = useGameStore((s) => s.commitLiveQualifyingGrid)
  const runQualifyingHeadless = useGameStore((s) => s.runQualifyingHeadless)
  const tickQuali = useGameStore((s) => s.tickQuali)
  const pauseQuali = useGameStore((s) => s.pauseQuali)
  const resumeQuali = useGameStore((s) => s.resumeQuali)
  const setQualiSpeed = useGameStore((s) => s.setQualiSpeed)
  const selectQualiTire = useGameStore((s) => s.selectQualiTire)
  const sendQualiLap = useGameStore((s) => s.sendQualiLap)
  const abortQualiLap = useGameStore((s) => s.abortQualiLap)
  const revealQualiAttempt = useGameStore((s) => s.revealQualiAttempt)
  const endQualiSegment = useGameStore((s) => s.endQualiSegment)
  const advancePhase = useGameStore((s) => s.advancePhase)

  const { weekendState, gameState, drivers, teams, calendar } = world
  const round = gameState?.currentRound ?? 1
  const race = calendar?.[round - 1]
  // Format is PHASE-driven, NOT weekend-driven. A sprint weekend runs BOTH a
  // sprint-qualifying phase (SQ segments → sprintQualifyingResult) and a later
  // qualifying phase (Q segments → qualifyingResult), and `race.isSprint` is true
  // for both — only the phase tells them apart. (Standard weekends only ever hit
  // the qualifying phase.)
  const format: QualiFormat = gameState?.phase === 'sprint-qualifying' ? 'sprint-qualifying' : 'qualifying'
  const isSprint = format === 'sprint-qualifying'
  const segmentDefs = QUALI_SEGMENTS[format]
  const totalSegments = segmentDefs.length
  const playerTeamId = gameState?.playerTeamId ?? ''

  const circuitCompounds = useMemo<TireCompound[]>(
    () => (race?.circuit.compounds ? [...race.circuit.compounds] : []),
    [race],
  )

  const playerRacers = useMemo(
    () => (drivers ?? []).filter((d) => d.teamId === playerTeamId && !d.isReserve && !d.isF2),
    [drivers, playerTeamId],
  )

  const driverMetaById = useMemo(() => {
    const m: Record<string, { code: string; name: string; teamColor: string; isPlayer: boolean }> = {}
    const colorByTeam: Record<string, string> = {}
    for (const t of teams ?? []) colorByTeam[t.id] = t.color
    for (const d of drivers ?? []) {
      if (!d.teamId || d.isReserve || d.isF2) continue
      m[d.id] = {
        code: d.shortName,
        name: `${d.firstName} ${d.lastName}`,
        teamColor: colorByTeam[d.teamId] ?? '#666',
        isPlayer: d.teamId === playerTeamId,
      }
    }
    return m
  }, [drivers, teams, playerTeamId])

  // ── Reveal loop bookkeeping (refs — never trigger renders) ──────────────────
  const fullSegmentRef = useRef<QualiSegmentResult | null>(null) // segmentEnd source (read in the interval)
  // Reactive mirror of the active segment, used by the tower for render-time
  // sector lookup (a ref can't be read during render). Set alongside the ref.
  const [segForSectors, setSegForSectors] = useState<QualiSegmentResult | null>(null)
  const revealOrderRef = useRef<QualiDriverResult[]>([]) // entrants order = "cars going out"
  const revealIndexRef = useRef(0)
  const allSegmentsRef = useRef<QualiSegmentResult[]>([])
  const segmentIndexRef = useRef(0)
  const segmentBudgetRef = useRef(0)
  // True once a segment's close branch has fired — an explicit single-fire guard
  // so the close (endQualiSegment + commitLiveQualifyingGrid) can never run twice,
  // independent of the reveal-index arithmetic. Reset per segment in startSegment.
  const segmentClosedRef = useRef(false)

  const status = runtime.sessionPhase
  const simSpeed = runtime.simSpeed

  // Snapshot the player tire selections (made in the command panel before a
  // segment starts) into engine player commands. Read BEFORE runQualiSegment
  // blanks driverLive at segmentStart. Unselected → soft auto-run.
  const buildPlayerCommands = useCallback((): Record<string, { compound: TireCompound; aborted: boolean }> => {
    const st = useGameStore.getState()
    const w = st.world
    if (!w) return {}
    const soft = w.calendar[(w.gameState.currentRound) - 1]?.circuit.compounds[2]
    const live = st.qualifyingRuntime.driverLive
    const cmds: Record<string, { compound: TireCompound; aborted: boolean }> = {}
    for (const d of w.drivers) {
      if (d.teamId !== w.gameState.playerTeamId || d.isReserve || d.isF2) continue
      const compound = live[d.id]?.compound ?? soft
      if (compound) cmds[d.id] = { compound, aborted: false }
    }
    return cmds
  }, [])

  // Launch one segment: read the entrants (Q1 = roster order; later = prior
  // segment's advancing list), snapshot player commands, run the engine via the
  // store, and arm the reveal sequence in entrants order.
  const startSegment = useCallback(
    (idx: number) => {
      const st = useGameStore.getState()
      const w = st.world
      if (!w) return
      const def = QUALI_SEGMENTS[format][idx]
      const entrants =
        idx === 0
          ? // Match buildQualiBootstrapDrivers EXACTLY (also drop any driver whose
            // teamId doesn't resolve to a team) so the live entrants set can never
            // diverge from the engine's driver list — otherwise live ≠ headless on
            // the same seed for a dangling-teamId edge.
            w.drivers
              .filter((d) => d.teamId && !d.isReserve && !d.isF2 && w.teams.some((t) => t.id === d.teamId))
              .map((d) => d.id)
          : allSegmentsRef.current[idx - 1]?.advancing ?? []
      const playerCommands = buildPlayerCommands()
      const result = runQualiSegment({
        segment: def.segment,
        entrants,
        advancingCount: Math.min(def.advancing, entrants.length),
        playerCommands,
      })
      if (!result) return
      segmentIndexRef.current = idx
      allSegmentsRef.current[idx] = result
      fullSegmentRef.current = result
      setSegForSectors(result)
      revealOrderRef.current = entrants
        .map((id) => result.results.find((r) => r.driverId === id))
        .filter((r): r is QualiDriverResult => Boolean(r))
      revealIndexRef.current = 0
      segmentClosedRef.current = false
      segmentBudgetRef.current = useGameStore.getState().qualifyingRuntime.segmentTimeRemaining
    },
    [format, runQualiSegment, buildPlayerCommands],
  )

  // ── Reveal interval: unveil one entrant per tick, then close the segment ─────
  useEffect(() => {
    if (status !== 'running') return
    const intervalMs = REVEAL_INTERVAL_MS[String(simSpeed)] ?? 450
    const id = setInterval(() => {
      const order = revealOrderRef.current
      const full = fullSegmentRef.current
      if (!full) return
      const k = revealIndexRef.current
      if (k < order.length) {
        revealQualiAttempt(order[k])
        revealIndexRef.current = k + 1
        // Decrement by budget/(order.length+1) so the cosmetic clock NEVER reaches
        // 0 during the reveal. If it hit 0 on the last reveal tick, the reducer's
        // tick→0 auto-transition to 'segment-end' would tear down this interval
        // BEFORE the k===order.length close branch runs — hanging the session with
        // no committed grid (most reliably on Q3/SQ3, where the budget divides
        // evenly). The clock stays purely cosmetic; the close is owned solely by
        // the reveal index below.
        const budget = segmentBudgetRef.current || order.length
        tickQuali(budget / (order.length + 1))
      } else if (k === order.length && !segmentClosedRef.current) {
        // Segment over — apply the final classification, then either await the
        // player's "next segment" or (last segment) collate + commit the grid.
        segmentClosedRef.current = true
        endQualiSegment(full)
        revealIndexRef.current = k + 1 // belt-and-suspenders with segmentClosedRef
        if (segmentIndexRef.current >= totalSegments - 1) {
          commitLiveQualifyingGrid(format, allSegmentsRef.current)
        }
      }
    }, intervalMs)
    return () => clearInterval(id)
  }, [status, simSpeed, totalSegments, format, revealQualiAttempt, endQualiSegment, tickQuali, commitLiveQualifyingGrid])

  // ── View-model ──────────────────────────────────────────────────────────────
  const liveSeg = runtime.segment
  const segmentIndex = liveSeg ? Math.max(0, segmentDefs.findIndex((d) => d.segment === liveSeg)) : 0
  const cutlinePosition = runtime.cutlinePosition

  const tower: QualiTowerEntry[] = useMemo(() => {
    const live = runtime.driverLive
    const ids = Object.keys(live)
    const full = segForSectors
    const order = new Map(ids.map((id, i) => [id, i]))
    const rows = ids.map((id) => {
      const l = live[id]
      const meta = driverMetaById[id]
      const dr = full?.results.find((r) => r.driverId === id)
      const att = dr?.attempts[dr.attempts.length - 1]
      const revealed = l.bestLapTime !== null
      return {
        driverId: id,
        code: meta?.code ?? id.slice(0, 3).toUpperCase(),
        driverName: meta?.name ?? id,
        teamColor: meta?.teamColor ?? '#666',
        isPlayer: meta?.isPlayer ?? false,
        bestLapTime: l.bestLapTime,
        sectors:
          revealed && att
            ? { s1: att.sector1 ?? 0, s2: att.sector2 ?? 0, s3: att.sector3 ?? 0 }
            : null,
        tire: compoundLabel(l.compound, circuitCompounds),
        eliminated: l.eliminated,
      }
    })
    rows.sort((a, b) => {
      const at = a.bestLapTime
      const bt = b.bestLapTime
      if (at === null && bt === null) return order.get(a.driverId)! - order.get(b.driverId)!
      if (at === null) return 1
      if (bt === null) return -1
      if (at !== bt) return at - bt
      return order.get(a.driverId)! - order.get(b.driverId)!
    })
    return rows.map((r, i) => ({
      ...r,
      position: i + 1,
      isBelowCutline: cutlinePosition > 0 && i + 1 > cutlinePosition,
    }))
  }, [runtime.driverLive, driverMetaById, circuitCompounds, cutlinePosition, segForSectors])

  const players: QualiPlayerControl[] = useMemo(
    () =>
      playerRacers.map((d) => ({
        driverId: d.id,
        code: d.shortName,
        compound: runtime.driverLive[d.id]?.compound ?? null,
      })),
    [playerRacers, runtime.driverLive],
  )

  const setsByCompound = useMemo(() => {
    const remaining = weekendState?.tireLedger.remaining ?? {}
    const acc: Partial<Record<TireCompound, number>> = {}
    for (const c of circuitCompounds) acc[c] = remaining[c] ?? 0
    return acc
  }, [weekendState?.tireLedger.remaining, circuitCompounds])

  const classification: QualiClassificationRow[] | null = useMemo(() => {
    const fc = runtime.finalClassification
    if (!fc) return null
    return fc.gridOrder.map((id, i) => ({
      position: i + 1,
      driverId: id,
      code: driverMetaById[id]?.code ?? id.slice(0, 3).toUpperCase(),
      driverName: driverMetaById[id]?.name ?? id,
      teamColor: driverMetaById[id]?.teamColor ?? '#666',
      isPlayer: driverMetaById[id]?.isPlayer ?? false,
      bestTime: fc.bestTimes[id] ?? null,
      isPole: id === fc.pole.driverId,
      isFastest: fc.fastestLap?.driverId === id,
    }))
  }, [runtime.finalClassification, driverMetaById])

  const pole = useMemo(() => {
    const fc = runtime.finalClassification
    if (!fc) return null
    return { driverId: fc.pole.driverId, code: driverMetaById[fc.pole.driverId]?.code ?? '', time: fc.pole.time }
  }, [runtime.finalClassification, driverMetaById])

  const fastest = useMemo(() => {
    const fl = runtime.finalClassification?.fastestLap
    if (!fl) return null
    return { driverId: fl.driverId, code: driverMetaById[fl.driverId]?.code ?? '', time: fl.time }
  }, [runtime.finalClassification, driverMetaById])

  const segmentLabel = liveSeg ?? segmentDefs[0].segment
  const state: QualifyingSessionView = useMemo(
    () => ({
      sessionPhase: status,
      simSpeed,
      format,
      isSprint,
      segmentLabel,
      segmentName: `${isSprint ? 'Sprint Qualifying' : 'Qualifying'} ${segmentIndex + 1}`,
      nextSegmentLabel: segmentIndex < totalSegments - 1 ? segmentDefs[segmentIndex + 1].segment : '',
      segmentIndex,
      totalSegments,
      segmentTimeRemaining: runtime.segmentTimeRemaining,
      cutlinePosition,
      weather: runtime.weather,
      circuitId: race?.circuit.id ?? '',
      circuitName: race?.circuit.name ?? '',
      raceName: race?.name ?? '',
      round,
      circuitCompounds,
      setsByCompound,
      tower,
      players,
      commentary: runtime.commentary,
      classification,
      pole,
      fastest,
      isLastSegment: segmentIndex >= totalSegments - 1,
      canBegin: status === 'idle',
      canSkip: status === 'idle',
    }),
    [
      status, simSpeed, format, isSprint, segmentLabel, segmentIndex, totalSegments,
      runtime.segmentTimeRemaining, cutlinePosition, runtime.weather, runtime.commentary,
      race, round, circuitCompounds, setsByCompound, tower, players, classification, pole, fastest,
    ],
  )

  // ── Action wrappers ───────────────────────────────────────────────────────--
  const begin = useCallback(() => {
    allSegmentsRef.current = []
    segmentIndexRef.current = 0
    revealIndexRef.current = 0
    fullSegmentRef.current = null
    setSegForSectors(null)
    initQualiSession(format)
    startSegment(0)
  }, [format, initQualiSession, startSegment])

  const nextSegment = useCallback(() => {
    startSegment(segmentIndexRef.current + 1)
  }, [startSegment])

  const skip = useCallback(() => {
    initQualiSession(format)
    runQualifyingHeadless(format)
  }, [format, initQualiSession, runQualifyingHeadless])

  const confirmGrid = useCallback(() => advancePhase(), [advancePhase])
  const selectTire = useCallback(
    (driverId: string, compound: TireCompound) => selectQualiTire(driverId, compound),
    [selectQualiTire],
  )
  const setSpeed = useCallback((speed: SimSpeed) => setQualiSpeed(speed), [setQualiSpeed])
  const pause = useCallback(() => pauseQuali(), [pauseQuali])
  const resume = useCallback(() => resumeQuali(), [resumeQuali])

  const codeFor = useCallback(
    (driverId: string) => driverMetaById[driverId]?.code ?? driverId.slice(0, 3).toUpperCase(),
    [driverMetaById],
  )
  const sendLap = useCallback(
    (driverId: string) => {
      sendQualiLap(driverId)
      useGameStore.getState().pushQualiCommentary([
        { lap: segmentIndex + 1, text: `${codeFor(driverId)} fires up for a hot lap.`, severity: 'highlight' },
      ])
    },
    [sendQualiLap, codeFor, segmentIndex],
  )
  const abortLap = useCallback(
    (driverId: string) => {
      abortQualiLap(driverId)
      useGameStore.getState().pushQualiCommentary([
        { lap: segmentIndex + 1, text: `${codeFor(driverId)} backs out and returns to the pits.`, severity: 'info' },
      ])
    },
    [abortQualiLap, codeFor, segmentIndex],
  )

  return {
    state,
    begin,
    nextSegment,
    skip,
    confirmGrid,
    selectTire,
    setSpeed,
    pause,
    resume,
    sendLap,
    abortLap,
  }
}
