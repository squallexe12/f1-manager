import type { Sponsor, SponsorKPI, PrestigeRating } from '@/types/finance'
import type { SponsorTemplate } from '@/data/sponsors'

const PRESTIGE_ORDER: PrestigeRating[] = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F']

function prestigeLevel(rating: PrestigeRating): number {
  return PRESTIGE_ORDER.indexOf(rating)
}

/**
 * Update KPI progress for a sponsor after a race.
 */
export function updateSponsorKPIs(
  sponsor: Sponsor,
  kpiUpdates: Record<number, number>, // kpi index → new current value
): Sponsor {
  const kpis = sponsor.kpis.map((kpi, idx) => {
    if (idx in kpiUpdates) {
      const current = kpiUpdates[idx]
      return { ...kpi, current, met: current >= kpi.target }
    }
    return kpi
  })

  const metCount = kpis.filter(k => k.met).length
  const satisfaction = Math.round((metCount / Math.max(1, kpis.length)) * 100)

  return { ...sponsor, kpis, satisfaction }
}

/**
 * Check if a sponsor is at risk of departing (satisfaction below 30).
 */
export function isSponsorAtRisk(sponsor: Sponsor): boolean {
  return sponsor.satisfaction < 30
}

/**
 * Filter sponsor templates available for a given prestige rating.
 */
export function getAvailableSponsors(
  templates: SponsorTemplate[],
  prestige: PrestigeRating,
  existingSponsorIds: string[],
): SponsorTemplate[] {
  const teamLevel = prestigeLevel(prestige)
  return templates.filter(t =>
    !existingSponsorIds.includes(t.id) &&
    prestigeLevel(t.minimumPrestige) >= teamLevel
  )
}

/**
 * Create a Sponsor from a template when signing a deal.
 */
export function signSponsor(template: SponsorTemplate, currentSeason: number): Sponsor {
  return {
    id: template.id,
    name: template.name,
    tier: template.tier,
    annualValue: template.annualValue,
    bonusValue: template.bonusValue,
    kpis: template.kpiTemplates.map(k => ({
      description: k.description,
      target: k.target,
      current: 0,
      met: false,
    })),
    satisfaction: 60, // neutral starting satisfaction
    contractEndSeason: currentSeason + template.contractLength,
    minimumPrestige: template.minimumPrestige,
  }
}
