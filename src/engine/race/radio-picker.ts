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
    return replacements[key]
  })
}

function archetypesIntersect(
  templateArchetypes: RadioArchetype[] | undefined,
  driverArchetypes: [RadioArchetype, RadioArchetype?],
): boolean {
  if (!templateArchetypes || templateArchetypes.length === 0) return true
  return templateArchetypes.some(t => driverArchetypes.includes(t))
}

function eligibleTemplates(
  ctx: RadioContext,
  profile: DriverRadioProfile,
): RadioTemplate[] {
  const frustration = ctx.driver.mood.frustration
  return RADIO_TEMPLATES.filter(t =>
    t.category === ctx.category &&
    t.speaker === ctx.speaker &&
    archetypesIntersect(t.archetypes, profile.archetypes) &&
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
  const archetypes = profile?.archetypes ?? ['calm-pro'] as [RadioArchetype]
  const fakeProfile: DriverRadioProfile = profile ?? { driverId: ctx.driver.id, archetypes }
  const pool = eligibleTemplates(ctx, fakeProfile)

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
