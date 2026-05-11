/**
 * templates.ts — IP-10 Press Conference & Media Management
 *
 * Pure template resolver: substitutes typed placeholder tokens in a
 * PressQuestion.template string with concrete context values, producing a
 * ResolvedPressQuestion ready for UI rendering.
 *
 * Architecture invariant: this module is pure. No PRNG, no side effects,
 * no browser APIs. No imports from stores, hooks, or components.
 */

import type { PressQuestion, ResolvedPressQuestion } from '@/types/media'
import { TEMPLATE_PLACEHOLDERS } from '@/types/media'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TemplateContext {
  driverName: string
  teamName: string
  /** Numeric finishing position, or 'DNF' for a retirement. */
  position: number | 'DNF'
  circuit: string
  teammateName: string
  rivalTeamName: string
  seasonYear: number
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Map of every template placeholder to its replacement string.
 * Using a regex with the `g` flag ensures all occurrences in a template
 * are replaced — not just the first.
 */
function buildReplacementMap(ctx: TemplateContext): Array<[RegExp, string]> {
  return [
    [/\{driverName\}/g,    ctx.driverName],
    [/\{teamName\}/g,      ctx.teamName],
    [/\{position\}/g,      String(ctx.position)],
    [/\{circuit\}/g,       ctx.circuit],
    [/\{teammateName\}/g,  ctx.teammateName],
    [/\{rivalTeamName\}/g, ctx.rivalTeamName],
    [/\{seasonYear\}/g,    String(ctx.seasonYear)],
  ]
}

/**
 * Replace all known template placeholders in `question.template` with
 * concrete values from `ctx`.
 *
 * Unknown placeholders (e.g. `{mysteryField}`) are left intact — this
 * makes template authoring errors immediately visible in tests rather than
 * silently producing partial output.
 */
export function resolveTemplate(
  question: PressQuestion,
  ctx: TemplateContext,
): ResolvedPressQuestion {
  let text = question.template

  for (const [pattern, value] of buildReplacementMap(ctx)) {
    text = text.replace(pattern, value)
  }

  return {
    id: question.id,
    questionId: question.id,
    outlet: question.outlet,
    journalist: question.journalist,
    text,
    answers: question.answers,
  }
}

// ---------------------------------------------------------------------------
// Validation helper
// ---------------------------------------------------------------------------

/**
 * Return any `{placeholder}` tokens in `template` that are not listed in
 * `TEMPLATE_PLACEHOLDERS`. Consumed by the question-bank validator (Task 7).
 *
 * @param template - Raw template string from a PressQuestion.
 * @returns Array of unrecognised placeholder tokens, e.g. `['{mysteryField}']`.
 */
export function findUnknownPlaceholders(template: string): string[] {
  const found = template.match(/\{[a-zA-Z]+\}/g) ?? []
  return found.filter(p => !(TEMPLATE_PLACEHOLDERS as readonly string[]).includes(p))
}
