export type EventThread =
  | 'driver-rivalry'
  | 'media-pressure'
  | 'poaching-politics'
  | 'sponsor-drama'
  | 'paddock-scandal'
  | 'multi-race-arc'

export type EventSeverity = 'breaking' | 'decision' | 'technical' | 'rumor' | 'news'

export interface EventOption {
  id: string
  text: string
  consequences: EventConsequence[]
}

export interface EventConsequence {
  type: 'morale' | 'mood' | 'budget' | 'prestige' | 'performance' | 'relationship' | 'staff'
  targetId?: string
  delta: number
  description: string
}

export interface NarrativeEvent {
  id: string
  thread: EventThread
  severity: EventSeverity
  headline: string
  body: string
  options: EventOption[] | null // null = informational only
  defaultOutcome: EventConsequence[] | null
  arcId: string | null
  triggeredAtRound: number
  expiresAtRound: number | null
  resolved: boolean
}

export type ArcStage = 'building' | 'escalating' | 'climax' | 'resolution'

export interface StoryArc {
  id: string
  thread: EventThread
  title: string
  description: string
  stage: ArcStage
  startedAtRound: number
  involvedDriverIds: string[]
  involvedTeamIds: string[]
  eventIds: string[]
}
