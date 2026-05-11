export type PressContextTag =
  | 'after-podium'
  | 'after-points'
  | 'after-zero-points'
  | 'after-dnf'
  | 'after-crash'
  | 'teammate-beat-you'
  | 'beat-teammate'
  | 'after-pole'
  | 'after-q1-exit'
  | 'contract-expiring'
  | 'rumored-poach'
  | 'reg-controversy'
  | 'penalty-received'
  | 'budget-cap-pressure'
  | 'season-opener'
  | 'season-finale'
  | 'home-race'
  | 'driver-mood-low'
  | 'driver-mood-high'
  | 'prestige-rising'
  | 'prestige-falling'

export type PressSpeaker = 'driver' | 'team-principal'
export type PressSurface = 'thursday-fia' | 'post-race'

export type PressAnswerTone =
  | 'aggressive' | 'diplomatic' | 'modest' | 'defiant' | 'evasive'

export type PressRumorBucket = 'inflammatory' | 'gracious' | 'mysterious'

export interface PressAnswerDelta {
  driverMood?: number      // -10..+10 per-answer (absolute mood points)
  teammateMood?: number    // -5..+5 per-answer
  sponsorKPI?: number      // -3..+3 per-answer
  prestige?: number        // -2..+2 per-answer
  rumorWeight?: Partial<Record<PressRumorBucket, number>>  // 0..3 per bucket
}

export interface PressAnswer {
  id: string
  text: string
  tone: PressAnswerTone
  delta: PressAnswerDelta
}

export interface PressQuestion {
  id: string
  contextTags: PressContextTag[]
  speaker: PressSpeaker
  outlet: string
  journalist: string
  template: string
  /** Relative pick weight in `weightedPickN`. Range: 0.5..3.0; default 1.0. */
  weight: number
  answers: PressAnswer[]
}

export interface ResolvedPressQuestion {
  id: string
  questionId: string
  outlet: string
  journalist: string
  text: string
  answers: PressAnswer[]
}

export type PressEventStatus = 'pending' | 'in-progress' | 'resolved' | 'skipped'

export interface PressEvent {
  id: string
  surface: PressSurface
  speakerKind: PressSpeaker
  speakerDriverId?: string
  circuit: string
  round: number
  season: number
  questions: ResolvedPressQuestion[]
  /**
   * Parallel array to `questions`. `answeredAnswerIds[i]` is the chosen answer id
   * for `questions[i]`, or `null` if that slot is unanswered. INVARIANT: length
   * MUST always equal `questions.length`. Initialized to all-null in `buildPressEvent`.
   */
  answeredAnswerIds: (string | null)[]
  status: PressEventStatus
  resolvedAt?: number
}

export interface PressTranscriptExchange {
  question: string
  answer: string
  tone: PressAnswerTone
}

export interface PressTranscript {
  eventId: string
  surface: PressSurface
  round: number
  season: number
  speakerLabel: string
  /** Snapshot of the speaking driver id at resolve time. `null` if Team Principal spoke. */
  speakerDriverId: string | null
  exchanges: PressTranscriptExchange[]
  aggregateDelta: PressAnswerDelta
}

export interface MediaSlice {
  pendingPress: PressEvent | null
  transcripts: PressTranscript[]
}

/** Cap for `transcripts` array — FIFO eviction beyond this. */
export const TRANSCRIPT_CAP = 22

/** Template placeholders the validator accepts. */
export const TEMPLATE_PLACEHOLDERS = [
  '{driverName}',
  '{teamName}',
  '{position}',
  '{circuit}',
  '{teammateName}',
  '{rivalTeamName}',
  '{seasonYear}',
] as const

export type TemplatePlaceholder = typeof TEMPLATE_PLACEHOLDERS[number]
