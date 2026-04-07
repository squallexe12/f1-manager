import type { EventThread, EventSeverity, EventConsequence } from '@/types/narrative'

export interface EventCondition {
  type: 'driver-frustration-high' | 'driver-confidence-low' | 'teammate-rivalry'
    | 'sponsor-unhappy' | 'budget-cap-risk' | 'consecutive-dnfs'
    | 'winning-streak' | 'media-attention' | 'poaching-risk'
    | 'staff-issue' | 'car-unreliable' | 'driver-contract-expiring'
  threshold?: number
  targetId?: string
}

export interface EventTemplate {
  id: string
  thread: EventThread
  severity: EventSeverity
  headline: string
  body: string
  conditions: EventCondition[]
  options: {
    id: string
    text: string
    consequences: EventConsequence[]
  }[] | null
  defaultOutcome: EventConsequence[] | null
  cooldownRaces: number
  expiresAfterRaces: number | null
}

export const EVENT_TEMPLATES: EventTemplate[] = [
  // === Driver Rivalry ===
  {
    id: 'rivalry-teammate-clash',
    thread: 'driver-rivalry', severity: 'decision',
    headline: 'Tension in the Garage',
    body: 'Your drivers had a heated exchange after the last race. {driver1} feels {driver2} is getting preferential treatment. How do you respond?',
    conditions: [{ type: 'driver-frustration-high', threshold: 65 }],
    options: [
      { id: 'mediate', text: 'Hold a private meeting to clear the air', consequences: [{ type: 'mood', delta: -10, description: 'Frustration reduced for both drivers' }] },
      { id: 'ignore', text: 'Let them sort it out themselves', consequences: [{ type: 'mood', delta: 5, description: 'Frustration festers' }] },
      { id: 'favor-d1', text: 'Publicly back Driver 1', consequences: [{ type: 'mood', targetId: 'driver1', delta: -15, description: 'Driver 1 calms down' }, { type: 'mood', targetId: 'driver2', delta: 20, description: 'Driver 2 furious' }] },
    ],
    defaultOutcome: [{ type: 'mood', delta: 8, description: 'Unresolved tension builds' }],
    cooldownRaces: 4, expiresAfterRaces: 2,
  },
  {
    id: 'rivalry-on-track-incident',
    thread: 'driver-rivalry', severity: 'highlight' as EventSeverity,
    headline: 'Teammates Collide!',
    body: 'Your two drivers made contact fighting for position. The stewards are investigating. The media is having a field day.',
    conditions: [{ type: 'teammate-rivalry' }],
    options: [
      { id: 'team-orders', text: 'Implement strict team orders going forward', consequences: [{ type: 'mood', delta: 15, description: 'Both drivers frustrated by team orders' }, { type: 'performance', delta: -2, description: 'Reduced aggression costs pace' }] },
      { id: 'let-race', text: 'Allow them to continue racing freely', consequences: [{ type: 'prestige', delta: 3, description: 'Fans love the drama' }, { type: 'mood', delta: 5, description: 'Rivalry intensifies' }] },
    ],
    defaultOutcome: [{ type: 'prestige', delta: -2, description: 'Team looks disorganized' }],
    cooldownRaces: 6, expiresAfterRaces: 1,
  },

  // === Media Pressure ===
  {
    id: 'media-poor-results',
    thread: 'media-pressure', severity: 'rumor',
    headline: 'Media Questions Team Direction',
    body: 'After a string of poor results, journalists are questioning the team\'s technical direction. Press conference incoming.',
    conditions: [{ type: 'driver-confidence-low', threshold: 40 }],
    options: [
      { id: 'confident', text: 'Project confidence — upgrades are coming', consequences: [{ type: 'prestige', delta: 2, description: 'Confident messaging reassures' }, { type: 'mood', delta: -5, description: 'Team morale slightly boosted' }] },
      { id: 'honest', text: 'Acknowledge struggles, promise changes', consequences: [{ type: 'prestige', delta: -1, description: 'Honesty appreciated but concerning' }, { type: 'staff', delta: 3, description: 'Staff feel heard' }] },
    ],
    defaultOutcome: [{ type: 'prestige', delta: -3, description: 'Silence interpreted as incompetence' }],
    cooldownRaces: 5, expiresAfterRaces: 2,
  },
  {
    id: 'media-driver-praise',
    thread: 'media-pressure', severity: 'news',
    headline: 'Driver of the Day Buzz',
    body: 'Your driver\'s outstanding performance is generating massive positive coverage. Sponsor inquiries are up.',
    conditions: [{ type: 'winning-streak' }],
    options: null,
    defaultOutcome: [{ type: 'prestige', delta: 5, description: 'Positive media coverage boosts brand' }, { type: 'mood', delta: -5, description: 'Driver confidence soars' }],
    cooldownRaces: 3, expiresAfterRaces: null,
  },

  // === Poaching Politics ===
  {
    id: 'poach-driver-targeted',
    thread: 'poaching-politics', severity: 'breaking',
    headline: 'Rival Team Approaches Your Driver',
    body: 'A top team has made an informal approach to {driver}. Your driver is listening. Contract talks may be needed.',
    conditions: [{ type: 'poaching-risk' }, { type: 'driver-contract-expiring' }],
    options: [
      { id: 'counter-offer', text: 'Immediately offer a contract extension', consequences: [{ type: 'budget', delta: -5_000_000, description: 'Premium to retain driver' }, { type: 'mood', delta: -10, description: 'Driver feels valued' }] },
      { id: 'wait', text: 'Monitor the situation', consequences: [{ type: 'mood', delta: 8, description: 'Driver feels unwanted' }] },
      { id: 'release', text: 'Accept it — start scouting replacements', consequences: [{ type: 'mood', delta: 15, description: 'Driver checked out mentally' }, { type: 'budget', delta: 3_000_000, description: 'Save on salary' }] },
    ],
    defaultOutcome: [{ type: 'relationship', delta: -10, description: 'Driver feels neglected' }],
    cooldownRaces: 8, expiresAfterRaces: 3,
  },
  {
    id: 'poach-staff-headhunted',
    thread: 'poaching-politics', severity: 'technical',
    headline: 'Key Engineer Headhunted',
    body: 'Your technical director has received an offer from a rival constructor. Losing them would slow R&D progress.',
    conditions: [{ type: 'staff-issue' }],
    options: [
      { id: 'retain', text: 'Match the offer with a raise', consequences: [{ type: 'budget', delta: -2_000_000, description: 'Salary increase costs' }, { type: 'staff', delta: 5, description: 'Staff loyalty reinforced' }] },
      { id: 'let-go', text: 'Wish them well and promote from within', consequences: [{ type: 'performance', delta: -3, description: 'R&D efficiency temporarily drops' }, { type: 'budget', delta: 1_000_000, description: 'Save on salary' }] },
    ],
    defaultOutcome: [{ type: 'staff', delta: -5, description: 'Staff morale drops from uncertainty' }],
    cooldownRaces: 10, expiresAfterRaces: 2,
  },

  // === Sponsor Drama ===
  {
    id: 'sponsor-unhappy-warning',
    thread: 'sponsor-drama', severity: 'decision',
    headline: 'Sponsor Demands Meeting',
    body: 'Your title sponsor is unhappy with recent results. They want a face-to-face to discuss KPI targets.',
    conditions: [{ type: 'sponsor-unhappy' }],
    options: [
      { id: 'promise-results', text: 'Promise improved results with specific plan', consequences: [{ type: 'prestige', delta: 1, description: 'Sponsor temporarily reassured' }] },
      { id: 'offer-extras', text: 'Offer additional marketing activations', consequences: [{ type: 'budget', delta: -1_000_000, description: 'Extra marketing spend' }, { type: 'prestige', delta: 2, description: 'Sponsor appreciates effort' }] },
    ],
    defaultOutcome: [{ type: 'prestige', delta: -5, description: 'Sponsor publicly expresses disappointment' }],
    cooldownRaces: 6, expiresAfterRaces: 2,
  },
  {
    id: 'sponsor-new-opportunity',
    thread: 'sponsor-drama', severity: 'news',
    headline: 'New Sponsor Interest',
    body: 'A major brand has expressed interest in sponsoring your team for next season. Strong recent results caught their eye.',
    conditions: [{ type: 'media-attention' }],
    options: null,
    defaultOutcome: [{ type: 'budget', delta: 3_000_000, description: 'Sponsorship pipeline strengthens' }],
    cooldownRaces: 5, expiresAfterRaces: null,
  },

  // === Paddock Scandal ===
  {
    id: 'scandal-budget-leak',
    thread: 'paddock-scandal', severity: 'breaking',
    headline: 'Budget Figures Leaked',
    body: 'Internal financial documents have been leaked to the press. The FIA is asking questions about your spending.',
    conditions: [{ type: 'budget-cap-risk' }],
    options: [
      { id: 'transparent', text: 'Open books to FIA immediately', consequences: [{ type: 'prestige', delta: 2, description: 'Transparency appreciated' }, { type: 'budget', delta: -500_000, description: 'Audit costs' }] },
      { id: 'deny', text: 'Deny and lawyer up', consequences: [{ type: 'prestige', delta: -5, description: 'Looks suspicious' }, { type: 'budget', delta: -2_000_000, description: 'Legal fees' }] },
    ],
    defaultOutcome: [{ type: 'prestige', delta: -8, description: 'Scandal escalates without response' }],
    cooldownRaces: 12, expiresAfterRaces: 2,
  },
  {
    id: 'scandal-technical-directive',
    thread: 'paddock-scandal', severity: 'technical',
    headline: 'Technical Directive Targets Your Car',
    body: 'The FIA has issued a technical directive that specifically impacts your floor design. Rivals lobbied for it.',
    conditions: [{ type: 'car-unreliable' }],
    options: [
      { id: 'comply', text: 'Comply immediately and redesign', consequences: [{ type: 'performance', delta: -4, description: 'Floor redesign costs downforce' }, { type: 'prestige', delta: 2, description: 'Good sportsmanship noted' }] },
      { id: 'challenge', text: 'Challenge the ruling formally', consequences: [{ type: 'budget', delta: -1_500_000, description: 'Legal challenge costs' }, { type: 'prestige', delta: -2, description: 'Seen as difficult' }] },
    ],
    defaultOutcome: [{ type: 'performance', delta: -3, description: 'Forced compliance with less time to adapt' }],
    cooldownRaces: 15, expiresAfterRaces: 3,
  },

  // === Multi-Race Arc ===
  {
    id: 'arc-championship-battle',
    thread: 'multi-race-arc', severity: 'news',
    headline: 'Championship Battle Heats Up',
    body: 'The points gap is closing. Media attention intensifies as every race becomes crucial.',
    conditions: [{ type: 'winning-streak' }],
    options: null,
    defaultOutcome: [{ type: 'mood', delta: -5, description: 'Pressure mounts on the team' }, { type: 'prestige', delta: 3, description: 'Global attention increases' }],
    cooldownRaces: 4, expiresAfterRaces: null,
  },
  {
    id: 'arc-reliability-crisis',
    thread: 'multi-race-arc', severity: 'technical',
    headline: 'Reliability Concerns Grow',
    body: 'Multiple mechanical issues across recent races suggest a systemic problem. Engineering needs to investigate.',
    conditions: [{ type: 'consecutive-dnfs' }, { type: 'car-unreliable' }],
    options: [
      { id: 'pause-development', text: 'Pause upgrades, focus on reliability', consequences: [{ type: 'performance', delta: 3, description: 'Reliability improves' }, { type: 'performance', delta: -2, description: 'Development stalls' }] },
      { id: 'push-through', text: 'Accept the risk, keep pushing', consequences: [{ type: 'mood', delta: 10, description: 'Drivers anxious about reliability' }] },
    ],
    defaultOutcome: [{ type: 'performance', delta: -2, description: 'Problem persists without action' }],
    cooldownRaces: 8, expiresAfterRaces: 3,
  },
]
