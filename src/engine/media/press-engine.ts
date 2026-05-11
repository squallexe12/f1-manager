/**
 * press-engine.ts — IP-10 Press Conference & Media Management
 *
 * Central press engine. 4 exported pure functions plus internal helpers
 * exported via `_internal` for test access.
 *
 * Architecture invariant: this module is pure. No side effects, no PRNG
 * except via the `rng` parameter, no browser APIs, no imports from stores,
 * hooks, components, or app. All state is JSON-serializable.
 */

import { type PRNG } from '@/engine/core/prng'
import { deriveContextTags } from '@/engine/media/context-tags'
import { resolveTemplate, type TemplateContext } from '@/engine/media/templates'
import type { FullGameState } from '@/engine/core/state-manager'
import type {
  PressQuestion,
  PressEvent,
  PressTranscript,
  PressTranscriptExchange,
  PressAnswerDelta,
  PressSurface,
  PressSpeaker,
  PressContextTag,
  PressRumorBucket,
} from '@/types/media'
import { TRANSCRIPT_CAP } from '@/types/media'
import type { RaceResult } from '@/engine/core/post-race-processor'
import { PRESS_BANK } from '@/data/media/press-bank'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum questions returned even if the tag set matches nothing. */
const MIN_QUESTIONS = 3

/** How many questions to include in a full press event. */
const EVENT_QUESTION_COUNT = 3

/** Per-event sum caps on aggregated deltas. */
const EVENT_CAPS = {
  driverMood: 15,
  teammateMood: 8,
  sponsorKPI: 5,
  prestige: 3,
  rumorWeightPerBucket: 3,
} as const

// ---------------------------------------------------------------------------
// Bank injection (test-only)
// ---------------------------------------------------------------------------

let _injectedBank: PressQuestion[] | null = null

/** Inject a replacement bank for unit tests. Reset with `_resetBankForTests`. */
function _setBankForTests(bank: PressQuestion[]): void {
  _injectedBank = bank
}

/** Reset the bank to the production default after test usage. */
function _resetBankForTests(): void {
  _injectedBank = null
}

function getBank(): PressQuestion[] {
  return _injectedBank ?? PRESS_BANK
}

// ---------------------------------------------------------------------------
// Speaker selection
// ---------------------------------------------------------------------------

/**
 * Compute a simple narrative score from a driver's last race result.
 * Higher score = more story interest = preferred speaker.
 */
function narrativeScore(driverId: string, results: RaceResult[]): number {
  const result = results.find(r => r.driverId === driverId)
  if (!result) return 0
  if (result.dnf) return 50 // DNFs are newsworthy
  // Lower position = higher score: P1 = 20, P10 = 11, P20 = 1
  return Math.max(0, 21 - result.position)
}

/**
 * Determine who speaks at the post-race press conference.
 *
 * Priority:
 *  1. The player driver with the highest narrative score (podium > DNF > points > backmarker).
 *  2. If both main drivers are banned, fall back to reserve → TP.
 *
 * @param world   - Full game world.
 * @param results - Race results for narrative score (from store session data).
 */
function selectPostRaceSpeaker(
  world: FullGameState,
  results: RaceResult[],
): { kind: PressSpeaker; driverId?: string } {
  const { playerTeamId } = world.gameState
  const team = world.teams.find(t => t.id === playerTeamId)
  const currentRound = world.gameState.currentRound

  // Get main (non-reserve) player drivers
  const mainDrivers = world.drivers.filter(
    d => d.teamId === playerTeamId && !d.isReserve,
  )

  // Drivers available (not banned for this round)
  const availableMain = mainDrivers.filter(
    d => d.banUntilRound === null || d.banUntilRound < currentRound,
  )

  if (availableMain.length > 0) {
    // Pick the driver with the highest narrative score
    const speaker = availableMain.reduce((best, d) => {
      const scoreD = narrativeScore(d.id, results)
      const scoreBest = narrativeScore(best.id, results)
      return scoreD > scoreBest ? d : best
    }, availableMain[0])
    return { kind: 'driver', driverId: speaker.id }
  }

  // All main drivers banned — try reserve
  const reserveDriver = team?.reserveDriverId != null
    ? world.drivers.find(d => d.id === team.reserveDriverId && d.isReserve)
    : undefined

  if (reserveDriver !== undefined) {
    return { kind: 'driver', driverId: reserveDriver.id }
  }

  // No driver available — TP speaks
  return { kind: 'team-principal' }
}

/**
 * Determine who speaks at the Thursday FIA press conference.
 *
 * Pick the player driver with higher motivation (as a proxy for
 * "most prominent" this week). Falls back to TP if both are banned or absent.
 */
function selectThursdaySpeaker(
  world: FullGameState,
): { kind: PressSpeaker; driverId?: string } {
  const { playerTeamId } = world.gameState
  const currentRound = world.gameState.currentRound
  const team = world.teams.find(t => t.id === playerTeamId)

  const mainDrivers = world.drivers.filter(
    d => d.teamId === playerTeamId && !d.isReserve,
  )

  const availableMain = mainDrivers.filter(
    d => d.banUntilRound === null || d.banUntilRound < currentRound,
  )

  if (availableMain.length > 0) {
    const speaker = availableMain.reduce((best, d) =>
      d.mood.motivation >= best.mood.motivation ? d : best,
    availableMain[0])
    return { kind: 'driver', driverId: speaker.id }
  }

  // Reserve fallback
  const reserveDriver = team?.reserveDriverId != null
    ? world.drivers.find(d => d.id === team.reserveDriverId && d.isReserve)
    : undefined

  if (reserveDriver !== undefined) {
    return { kind: 'driver', driverId: reserveDriver.id }
  }

  return { kind: 'team-principal' }
}

// ---------------------------------------------------------------------------
// Question picking
// ---------------------------------------------------------------------------

/**
 * Weighted random pick of n items from a pool using rng.
 *
 * Each item has a `weight` property. The algorithm builds a cumulative
 * weight array and picks by drawing from [0, totalWeight).
 * Items with weight ≤ 0 are excluded.
 * If the pool has fewer than n items, all items are returned (shuffled).
 */
function weightedPickN(pool: PressQuestion[], n: number, rng: PRNG): PressQuestion[] {
  const eligible = pool.filter(q => q.weight > 0)
  if (eligible.length <= n) return rng.shuffle(eligible)

  const chosen: PressQuestion[] = []
  const remaining = [...eligible]

  for (let i = 0; i < n && remaining.length > 0; i++) {
    const totalWeight = remaining.reduce((sum, q) => sum + q.weight, 0)
    let roll = rng.next() * totalWeight
    let idx = 0
    for (let j = 0; j < remaining.length; j++) {
      roll -= remaining[j].weight
      if (roll <= 0) {
        idx = j
        break
      }
    }
    chosen.push(remaining[idx])
    remaining.splice(idx, 1)
  }

  return chosen
}

/**
 * Select questions from the bank for the given context.
 *
 * 1. Primary pool: questions whose speaker matches AND at least one contextTag
 *    intersects the active tags (OR no contextTags at all — filler questions).
 * 2. If primary pool has fewer than MIN_QUESTIONS candidates, supplement with
 *    filler (speaker-matching, no contextTags) until we have enough.
 * 3. If still below MIN_QUESTIONS, open to any speaker's filler questions.
 *
 * @param bank        - The full question bank.
 * @param tags        - Active context tags for this event.
 * @param speakerKind - The speaker kind (driver | team-principal).
 * @param rng         - Seeded PRNG.
 */
function pickQuestions(
  bank: PressQuestion[],
  tags: PressContextTag[],
  speakerKind: PressSpeaker,
  rng: PRNG,
): PressQuestion[] {
  const tagSet = new Set(tags)

  // Matches: speaker correct AND (has overlapping tag OR no tags)
  const primary = bank.filter(q => {
    if (q.speaker !== speakerKind) return false
    if (q.contextTags.length === 0) return true
    return q.contextTags.some(t => tagSet.has(t))
  })

  if (primary.length >= EVENT_QUESTION_COUNT) {
    return weightedPickN(primary, EVENT_QUESTION_COUNT, rng)
  }

  // Supplement with cross-speaker fillers (questions with no contextTags)
  const crossFiller = bank.filter(
    q => q.speaker !== speakerKind && q.contextTags.length === 0,
  )
  const supplemented = [...primary, ...crossFiller]

  if (supplemented.length >= MIN_QUESTIONS) {
    return weightedPickN(supplemented, EVENT_QUESTION_COUNT, rng)
  }

  // Last resort: anything in the bank
  return weightedPickN(bank.length > 0 ? bank : [], Math.min(EVENT_QUESTION_COUNT, bank.length), rng)
}

// ---------------------------------------------------------------------------
// Template context builder
// ---------------------------------------------------------------------------

/**
 * Build the TemplateContext from world state and the selected speaker.
 *
 * Chooses rival team as the constructor with the highest position that
 * is NOT the player team.
 */
function buildTemplateContext(
  world: FullGameState,
  speaker: { kind: PressSpeaker; driverId?: string },
): TemplateContext {
  const { playerTeamId, currentRound, season } = world.gameState

  const playerTeam = world.teams.find(t => t.id === playerTeamId)
  const teamName = playerTeam?.name ?? 'the team'

  const speakerDriver =
    speaker.driverId != null
      ? world.drivers.find(d => d.id === speaker.driverId)
      : undefined

  const driverName =
    speakerDriver != null
      ? `${speakerDriver.firstName} ${speakerDriver.lastName}`
      : 'Team Principal'

  // Teammate: non-reserve player driver that isn't the speaker
  const teammate = world.drivers.find(
    d =>
      d.teamId === playerTeamId &&
      !d.isReserve &&
      d.id !== speaker.driverId,
  )
  const teammateName =
    teammate != null
      ? `${teammate.firstName} ${teammate.lastName}`
      : 'our driver'

  // Current circuit
  const currentRace = world.calendar[currentRound - 1]
  const circuit = currentRace?.circuit?.name ?? 'the circuit'

  // Rival team: best constructor not the player team
  const rivals = world.teams
    .filter(t => t.id !== playerTeamId)
    .sort((a, b) => (a.constructorPosition || 99) - (b.constructorPosition || 99))
  const rivalTeamName = rivals[0]?.name ?? 'the competition'

  // Position: last race result of speaker driver (or DNF / 0)
  let position: number | 'DNF' = 0
  if (speakerDriver?.lastRaceResult != null) {
    // FORM_DNF = 21 (null means no result yet per processPostRace)
    position = speakerDriver.lastRaceResult
  }

  return {
    driverName,
    teamName,
    position,
    circuit,
    teammateName,
    rivalTeamName,
    seasonYear: 2025 + season, // season 1 = 2026
  }
}

// ---------------------------------------------------------------------------
// Delta aggregation
// ---------------------------------------------------------------------------

/**
 * Aggregate all per-answer deltas for answered questions in a PressEvent.
 *
 * Only answered questions (where answeredAnswerIds[i] !== null) contribute.
 * Per-event sum caps are applied:
 *   driverMood: ±15, teammateMood: ±8, sponsorKPI: ±5, prestige: ±3,
 *   rumorWeight per-bucket: 0..3
 */
function aggregateDeltas(event: PressEvent): PressAnswerDelta {
  let driverMood = 0
  let teammateMood = 0
  let sponsorKPI = 0
  let prestige = 0
  const rumorWeight: Partial<Record<PressRumorBucket, number>> = {}

  for (let i = 0; i < event.questions.length; i++) {
    const answerId = event.answeredAnswerIds[i]
    if (answerId == null) continue

    const q = event.questions[i]
    const answer = q.answers.find(a => a.id === answerId)
    if (!answer) continue

    const d = answer.delta
    driverMood += d.driverMood ?? 0
    teammateMood += d.teammateMood ?? 0
    sponsorKPI += d.sponsorKPI ?? 0
    prestige += d.prestige ?? 0

    if (d.rumorWeight) {
      for (const [bucket, val] of Object.entries(d.rumorWeight) as [PressRumorBucket, number][]) {
        rumorWeight[bucket] = (rumorWeight[bucket] ?? 0) + val
      }
    }
  }

  // Apply per-event sum caps
  const clamp = (v: number, cap: number) => Math.max(-cap, Math.min(cap, v))

  const clampedRumorWeight: Partial<Record<PressRumorBucket, number>> = {}
  for (const [bucket, val] of Object.entries(rumorWeight) as [PressRumorBucket, number][]) {
    clampedRumorWeight[bucket] = Math.max(0, Math.min(EVENT_CAPS.rumorWeightPerBucket, val))
  }

  return {
    driverMood: clamp(driverMood, EVENT_CAPS.driverMood),
    teammateMood: clamp(teammateMood, EVENT_CAPS.teammateMood),
    sponsorKPI: clamp(sponsorKPI, EVENT_CAPS.sponsorKPI),
    prestige: clamp(prestige, EVENT_CAPS.prestige),
    ...(Object.keys(clampedRumorWeight).length > 0 ? { rumorWeight: clampedRumorWeight } : {}),
  }
}

// ---------------------------------------------------------------------------
// Delta application
// ---------------------------------------------------------------------------

/**
 * Apply aggregated press deltas to the world.
 *
 * - driverMood → speaker driver's mood.motivation, clamped [0, 100]
 * - teammateMood → teammate's mood.motivation, clamped [0, 100]
 * - sponsorKPI → TODO: wire through finance/sponsor helper
 *   (updateSponsorKPIs in src/engine/finance/sponsor-engine.ts doesn't have
 *   a simple "add delta to satisfaction" path; requires KPI index→value mapping
 *   which press events don't carry. Leaving TODO — delta recorded in transcript.)
 * - prestige → TODO: wire through finance/prestige helper
 *   (calculatePrestigeScore in src/engine/finance/prestige.ts requires
 *   PrestigeInput with constructorPosition, wins, etc.; there is no additive
 *   delta helper. Leaving TODO — delta recorded in transcript.)
 * - rumorWeight → TODO: wire through narrative/story-arc-tracker
 *   (story-arc-tracker.ts has createArc/advanceArcs/linkEventToArc but no
 *   additive rumorWeight helper. Leaving TODO — delta recorded in transcript.)
 */
function applyDeltas(
  world: FullGameState,
  delta: PressAnswerDelta,
  speakerDriverId?: string,
): FullGameState {
  let drivers = world.drivers

  // Apply driverMood to speaker
  if (delta.driverMood !== undefined && delta.driverMood !== 0 && speakerDriverId != null) {
    drivers = drivers.map(d => {
      if (d.id !== speakerDriverId) return d
      const newMotivation = Math.max(0, Math.min(100, d.mood.motivation + delta.driverMood!))
      return { ...d, mood: { ...d.mood, motivation: newMotivation } }
    })
  }

  // Apply teammateMood to the other non-reserve player driver
  if (delta.teammateMood !== undefined && delta.teammateMood !== 0 && speakerDriverId != null) {
    const { playerTeamId } = world.gameState
    drivers = drivers.map(d => {
      if (d.id === speakerDriverId) return d
      if (d.teamId !== playerTeamId || d.isReserve) return d
      const newMotivation = Math.max(0, Math.min(100, d.mood.motivation + delta.teammateMood!))
      return { ...d, mood: { ...d.mood, motivation: newMotivation } }
    })
  }

  // TODO: wire through finance/sponsor helper (src/engine/finance/sponsor-engine.ts)
  // sponsorKPI delta is recorded in the transcript aggregateDelta but not applied to
  // sponsor satisfaction here because updateSponsorKPIs requires explicit KPI index
  // mapping which press events don't carry.

  // TODO: wire through finance/prestige helper (src/engine/finance/prestige.ts)
  // prestige delta is recorded in the transcript aggregateDelta but not applied to
  // FinanceState.prestigeScore here because calculatePrestigeScore requires full
  // PrestigeInput (position, wins, marketability, media events) rather than an
  // additive delta.

  // TODO: wire through narrative/story-arc-tracker (src/engine/narrative/story-arc-tracker.ts)
  // rumorWeight delta is recorded in the transcript aggregateDelta but no additive
  // bump function exists in story-arc-tracker yet.

  return { ...world, drivers }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a PressEvent for the given surface and world state.
 *
 * Deterministic: identical world + surface + rng seed → identical event.
 *
 * @param world   - Full game world.
 * @param surface - Which press conference surface.
 * @param rng     - Seeded PRNG (caller must namespace the seed).
 *                  Recommended: createPRNG(world.gameState.seed + world.gameState.currentRound + PRNG_NS.thursday/postRace)
 */
export function buildPressEvent(
  world: FullGameState,
  surface: PressSurface,
  rng: PRNG,
): PressEvent {
  const { currentRound, season } = world.gameState

  // 1. Determine speaker
  const speaker =
    surface === 'post-race'
      ? selectPostRaceSpeaker(world, []) // no session results available from pure world
      : selectThursdaySpeaker(world)

  // 2. Derive context tags
  const tags = deriveContextTags(world, surface, speaker.driverId)

  // 3. Pick questions from the bank
  const bank = getBank()
  const rawQuestions = pickQuestions(bank, tags, speaker.kind, rng)

  // 4. Build template context and resolve questions
  const ctx = buildTemplateContext(world, speaker)
  const resolvedQuestions = rawQuestions.map(q => resolveTemplate(q, ctx))

  // 5. Current circuit name for the event label
  const currentRace = world.calendar[currentRound - 1]
  const circuit = currentRace?.circuit?.name ?? 'Unknown Circuit'

  // 6. Build the event
  const event: PressEvent = {
    id: `press-${surface}-s${season}-r${currentRound}`,
    surface,
    speakerKind: speaker.kind,
    speakerDriverId: speaker.driverId,
    circuit,
    round: currentRound,
    season,
    questions: resolvedQuestions,
    answeredAnswerIds: resolvedQuestions.map(() => null),
    status: 'pending',
  }

  return event
}

/**
 * Record a player's answer to one question in the pending press event.
 *
 * Pure function — returns a new world. No-ops if:
 * - No pending press event.
 * - questionIndex out of range.
 * - answerId not found in the question's answers.
 *
 * @param world         - Full game world.
 * @param questionIndex - Index into `pendingPress.questions`.
 * @param answerId      - The id of the chosen answer.
 */
export function answerPressQuestion(
  world: FullGameState,
  questionIndex: number,
  answerId: string,
): FullGameState {
  const { pendingPress } = world.media
  if (pendingPress == null) return world

  if (questionIndex < 0 || questionIndex >= pendingPress.questions.length) return world

  const question = pendingPress.questions[questionIndex]
  const answerExists = question.answers.some(a => a.id === answerId)
  if (!answerExists) return world

  const newAnsweredAnswerIds = [...pendingPress.answeredAnswerIds]
  newAnsweredAnswerIds[questionIndex] = answerId

  return {
    ...world,
    media: {
      ...world.media,
      pendingPress: {
        ...pendingPress,
        answeredAnswerIds: newAnsweredAnswerIds,
        status: 'in-progress',
      },
    },
  }
}

/**
 * Resolve the pending press event after all questions have been answered.
 *
 * 1. Throws if any question is unanswered.
 * 2. Aggregates deltas (with per-event sum caps).
 * 3. Applies deltas to world state.
 * 4. Appends a PressTranscript (FIFO-capped at TRANSCRIPT_CAP = 22).
 * 5. Clears `pendingPress`.
 *
 * @param world - Full game world with all questions answered.
 * @param rng   - Seeded PRNG (currently unused in resolve but reserved for future randomised consequences).
 */
export function resolvePressEvent(
  world: FullGameState,
  rng: PRNG,
): FullGameState {
  const { pendingPress } = world.media
  if (pendingPress == null) return world

  // Validate all questions answered
  const unanswered = pendingPress.answeredAnswerIds.some(a => a == null)
  if (unanswered) {
    throw new Error('resolvePressEvent: all questions must be answered before resolving')
  }

  // Aggregate deltas
  const delta = aggregateDeltas(pendingPress)

  // Apply deltas to world
  const worldAfterDeltas = applyDeltas(world, delta, pendingPress.speakerDriverId)

  // Build exchanges for transcript
  const exchanges: PressTranscriptExchange[] = pendingPress.questions.map((q, i) => {
    const answerId = pendingPress.answeredAnswerIds[i]!
    const answer = q.answers.find(a => a.id === answerId)!
    return {
      question: q.text,
      answer: answer.text,
      tone: answer.tone,
    }
  })

  // Derive speaker label
  const speakerDriver =
    pendingPress.speakerDriverId != null
      ? world.drivers.find(d => d.id === pendingPress.speakerDriverId)
      : undefined
  const speakerLabel =
    speakerDriver != null
      ? `${speakerDriver.firstName} ${speakerDriver.lastName}`
      : 'Team Principal'

  const transcript: PressTranscript = {
    eventId: pendingPress.id,
    surface: pendingPress.surface,
    round: pendingPress.round,
    season: pendingPress.season,
    speakerLabel,
    speakerDriverId: pendingPress.speakerDriverId ?? null,
    exchanges,
    aggregateDelta: delta,
  }

  // FIFO cap at TRANSCRIPT_CAP
  const existingTranscripts = worldAfterDeltas.media.transcripts
  const newTranscripts = [...existingTranscripts, transcript]
  const capped =
    newTranscripts.length > TRANSCRIPT_CAP
      ? newTranscripts.slice(newTranscripts.length - TRANSCRIPT_CAP)
      : newTranscripts

  // Mark event resolved with timestamp (round-based)
  const resolvedEvent: typeof pendingPress = {
    ...pendingPress,
    status: 'resolved',
    resolvedAt: pendingPress.round,
  }
  void resolvedEvent // resolved event is preserved in transcript; pendingPress cleared
  void rng // reserved for future random consequences

  return {
    ...worldAfterDeltas,
    media: {
      pendingPress: null,
      transcripts: capped,
    },
  }
}

/**
 * Skip the pending press event without answering.
 *
 * Applies a fixed skip penalty: `{ driverMood: -3, prestige: -1 }` to the
 * speaker. Writes a transcript with status 'skipped' and empty exchanges.
 * Clears `pendingPress`.
 *
 * @param world - Full game world.
 * @param rng   - Seeded PRNG (reserved for future randomised consequences).
 */
export function skipPressEvent(
  world: FullGameState,
  rng: PRNG,
): FullGameState {
  const { pendingPress } = world.media
  if (pendingPress == null) return world

  const skipDelta: PressAnswerDelta = { driverMood: -3, prestige: -1 }

  // Apply skip penalty
  const worldAfterPenalty = applyDeltas(world, skipDelta, pendingPress.speakerDriverId)

  // Derive speaker label
  const speakerDriver =
    pendingPress.speakerDriverId != null
      ? world.drivers.find(d => d.id === pendingPress.speakerDriverId)
      : undefined
  const speakerLabel =
    speakerDriver != null
      ? `${speakerDriver.firstName} ${speakerDriver.lastName}`
      : 'Team Principal'

  const transcript: PressTranscript = {
    eventId: pendingPress.id,
    surface: pendingPress.surface,
    round: pendingPress.round,
    season: pendingPress.season,
    speakerLabel,
    speakerDriverId: pendingPress.speakerDriverId ?? null,
    exchanges: [],
    aggregateDelta: skipDelta,
  }

  const existingTranscripts = worldAfterPenalty.media.transcripts
  const newTranscripts = [...existingTranscripts, transcript]
  const capped =
    newTranscripts.length > TRANSCRIPT_CAP
      ? newTranscripts.slice(newTranscripts.length - TRANSCRIPT_CAP)
      : newTranscripts

  void rng // reserved for future random consequences

  return {
    ...worldAfterPenalty,
    media: {
      pendingPress: null,
      transcripts: capped,
    },
  }
}

// ---------------------------------------------------------------------------
// _internal — re-exports for tests only
// ---------------------------------------------------------------------------

export const _internal = {
  selectPostRaceSpeaker,
  selectThursdaySpeaker,
  pickQuestions,
  buildTemplateContext,
  aggregateDeltas,
  applyDeltas,
  weightedPickN,
  narrativeScore,
  _setBankForTests,
  _resetBankForTests,
}
