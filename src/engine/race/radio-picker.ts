// src/engine/race/radio-picker.ts
import type { PRNG } from '@/engine/core/prng'
import type {
  CommentaryEntry,
  RadioCategory,
  RadioSpeaker,
  TireCompound,
} from '@/types/race'
import type { Mood } from '@/types/driver'
import type { RadioArchetype, DriverRadioProfile, RadioTemplate } from '@/types/radio'
import { RADIO_TEMPLATES } from '@/data/race-radio'
import { DRIVER_RADIO_PROFILES } from '@/data/driver-radio-profiles'

const DEBUG_MODE = process.env.NODE_ENV !== 'production'

const DEFAULT_CATCHPHRASE_CHANCE = 0.25

/**
 * Minimal driver shape required by the picker.
 * Callers compose this from RaceDriver + display metadata (shortName, teamId)
 * that comes from the world's Driver record, not from the sim state.
 */
export interface RadioDriver {
  id: string
  shortName: string   // 3-letter TLA for token substitution, e.g. "NOR"
  teamId: string
  mood: Mood
}

export interface RadioContext {
  category: RadioCategory
  speaker: RadioSpeaker            // explicit — same category can have engineer/driver/fia variants
  driver: RadioDriver
  opponent?: RadioDriver
  team: { id: string; name: string }
  lap: number
  totalLaps: number
  position: number
  gap?: number
  compound?: TireCompound
  turn?: number
  isPlayerTeam: boolean
}

const PROFILE_BY_DRIVER_ID = new Map(
  DRIVER_RADIO_PROFILES.map(p => [p.driverId, p]),
)

function resolveTokens(text: string, ctx: RadioContext): string {
  const replacements: Record<string, string> = {
    driver: ctx.driver.shortName,
    opponent: ctx.opponent?.shortName ?? '',
    gap: ctx.gap !== undefined ? `${ctx.gap.toFixed(1)}s` : '',
    compound: ctx.compound ?? '',
    lap: String(ctx.lap),
    laps_remaining: String(ctx.totalLaps - ctx.lap),
    position: String(ctx.position),
    turn: ctx.turn !== undefined ? String(ctx.turn) : '',
  }
  return text.replace(/\{(\w+)\}/g, (match, key: string) => {
    if (!(key in replacements)) {
      if (DEBUG_MODE) {
        throw new Error(`Unknown token "{${key}}" in radio template: ${text}`)
      }
      return '...'
    }
    const value = replacements[key]
    // Empty value (token defined but ctx didn't supply it) → substitute placeholder
    return value === '' ? '...' : value
  })
}

function archetypesIntersect(
  templateArchetypes: RadioArchetype[] | undefined,
  driverArchetypes: readonly RadioArchetype[],
): boolean {
  // Generic templates (no archetype gate) — always match
  if (!templateArchetypes || templateArchetypes.length === 0) return true
  // Driver has no archetypes (missing profile) — only generic templates match (handled above)
  if (driverArchetypes.length === 0) return false
  return templateArchetypes.some(t => driverArchetypes.includes(t))
}

function eligibleTemplates(
  ctx: RadioContext,
  driverArchetypes: readonly RadioArchetype[],
): RadioTemplate[] {
  const frustration = ctx.driver.mood.frustration
  return RADIO_TEMPLATES.filter(t =>
    t.category === ctx.category &&
    t.speaker === ctx.speaker &&
    archetypesIntersect(t.archetypes, driverArchetypes) &&
    frustration >= (t.minFrustration ?? 0) &&
    frustration <= (t.maxFrustration ?? 100),
  )
}

function weightedPick(templates: RadioTemplate[], rng: PRNG): RadioTemplate {
  const totalWeight = templates.reduce((s, t) => s + (t.weight ?? 1), 0)
  let roll = rng.range(0, totalWeight)
  for (const t of templates) {
    roll -= t.weight ?? 1
    if (roll <= 0) return t
  }
  return templates[templates.length - 1]
}

export function pickRadioMessage(ctx: RadioContext, rng: PRNG): CommentaryEntry {
  const profile = PROFILE_BY_DRIVER_ID.get(ctx.driver.id)

  // Signature roll
  const signaturePool = profile?.signatureLines?.[ctx.category]
  if (
    signaturePool &&
    signaturePool.length > 0 &&
    rng.chance(profile?.catchphraseChance ?? DEFAULT_CATCHPHRASE_CHANCE)
  ) {
    const text = rng.pick(signaturePool)
    return {
      lap: ctx.lap,
      text: resolveTokens(text, ctx),
      severity: 'radio',
      speaker: ctx.speaker,
      driverId: ctx.driver.id,
      teamId: ctx.team.id,
      category: ctx.category,
      tone: 'flat',
      isPlayerTeam: ctx.isPlayerTeam,
    }
  }

  // Archetype-eligible pool
  // Missing profile → empty archetypes → only generic templates (no archetype gate) are eligible (spec §6.2.1)
  const driverArchetypes: readonly RadioArchetype[] = profile?.archetypes.filter((a): a is RadioArchetype => a !== undefined) ?? []
  const pool = eligibleTemplates(ctx, driverArchetypes)

  if (pool.length === 0) {
    // Fallback — empty pool. Soft-warn in dev, return a neutral filler in prod.
    if (DEBUG_MODE) {
      console.warn(`No eligible radio template for category=${ctx.category} speaker=${ctx.speaker} driver=${ctx.driver.id}`)
    }
    return {
      lap: ctx.lap,
      text: '...',
      severity: 'radio',
      speaker: ctx.speaker,
      driverId: ctx.driver.id,
      teamId: ctx.team.id,
      category: ctx.category,
      tone: 'flat',
      isPlayerTeam: ctx.isPlayerTeam,
    }
  }

  const template = weightedPick(pool, rng)
  return {
    lap: ctx.lap,
    text: resolveTokens(template.text, ctx),
    severity: 'radio',
    speaker: ctx.speaker,
    driverId: ctx.driver.id,
    teamId: ctx.team.id,
    category: ctx.category,
    tone: template.tone ?? 'flat',
    isPlayerTeam: ctx.isPlayerTeam,
  }
}

// ---------------------------------------------------------------------------
// Broadcast curation filter
// ---------------------------------------------------------------------------

const FIA_ALWAYS_BROADCAST: ReadonlySet<RadioCategory> = new Set([
  'penalty_5s', 'penalty_drive_through', 'investigation',
  'safety_car_deploy', 'safety_car_in',
  'fastest_lap', 'lights_out', 'final_lap', 'rain_incoming',
])

const NON_PLAYER_CONDITIONAL: ReadonlySet<RadioCategory> = new Set([
  'overtake_done', 'overtake_failed', 'tire_complaint', 'driver_frustration',
])

export interface BroadcastRaceContext {
  championshipRivalIds: readonly string[]
  podiumPositions: readonly string[]   // driverIds in P1, P2, P3
  playerDriverIds?: readonly string[]
}

export function isBroadcastWorthy(
  category: RadioCategory,
  ctx: RadioContext,
  raceCtx: BroadcastRaceContext,
): boolean {
  if (ctx.isPlayerTeam) return true
  if (FIA_ALWAYS_BROADCAST.has(category)) return true
  if (!NON_PLAYER_CONDITIONAL.has(category)) return false

  const onPodium = raceCtx.podiumPositions.includes(ctx.driver.id)
  const isRival = raceCtx.championshipRivalIds.includes(ctx.driver.id)
  const opponentIsPlayer = ctx.opponent !== undefined &&
    (raceCtx.playerDriverIds?.includes(ctx.opponent.id) ?? false)

  return onPodium || isRival || opponentIsPlayer
}
