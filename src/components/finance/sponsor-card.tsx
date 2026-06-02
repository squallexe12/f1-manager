import type { Sponsor } from '@/types/finance'
import { Badge } from '@/components/ui/badge'
import { SPONSORS, type SponsorMetricKind } from '@/data/sponsors'

interface SponsorCardProps {
  sponsor: Sponsor
  currentSeason: number
  className?: string
}

function metricFor(sponsorId: string, index: number): SponsorMetricKind | undefined {
  return SPONSORS.find(t => t.id === sponsorId)?.kpiTemplates[index]?.metric
}

const POSITION_KINDS: SponsorMetricKind[] = ['constructorPosition']
const BINARY_KINDS: SponsorMetricKind[] = ['bothDriversScored', 'noCapBreach', 'teamDnfs']

/** Returns the right-hand value text and a 0..1 bar fill for a KPI. */
function kpiDisplay(kind: SponsorMetricKind | undefined, kpi: { current: number; target: number; met: boolean }): { label: string; fill01: number } {
  if (kind && POSITION_KINDS.includes(kind)) {
    return {
      label: `P${kpi.current} · target top ${kpi.target}`,
      fill01: kpi.met ? 1 : Math.max(0, (12 - kpi.current) / Math.max(1, 12 - kpi.target)),
    }
  }
  if (kind && BINARY_KINDS.includes(kind)) {
    return { label: `${kpi.current}/${kpi.target}`, fill01: kpi.met ? 1 : 0 }
  }
  // Accumulating gte (points/wins/podiums/finishes/marketability).
  return {
    label: `${kpi.current}/${kpi.target}`,
    fill01: kpi.target > 0 ? Math.min(1, kpi.current / kpi.target) : (kpi.met ? 1 : 0),
  }
}

const TIER_BADGE: Record<string, 'lime' | 'cyan' | 'neutral'> = {
  title: 'lime',
  major: 'cyan',
  minor: 'neutral',
}

function formatMoney(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  return `$${(value / 1_000).toFixed(0)}K`
}

export function SponsorCard({ sponsor, currentSeason, className = '' }: SponsorCardProps) {
  const seasonsRemaining = sponsor.contractEndSeason - currentSeason
  const isAtRisk = sponsor.satisfaction < 30
  const allKpisMet = sponsor.kpis.every(k => k.met)

  return (
    <div
      className={`
        bg-[var(--bg-surface)] border rounded-lg p-4
        ${isAtRisk ? 'border-[var(--accent-red)]/40' : 'border-[var(--border-default)]'}
        ${className}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-heading font-bold text-[var(--text-primary)]">
            {sponsor.name}
          </span>
          <Badge variant={TIER_BADGE[sponsor.tier] ?? 'neutral'}>
            {sponsor.tier}
          </Badge>
        </div>
        <span className="text-xs font-mono text-[var(--accent-lime)]">
          {formatMoney(sponsor.annualValue)}/yr
        </span>
      </div>

      {/* KPI Checklist */}
      <div className="flex flex-col gap-2 mb-3">
        {sponsor.kpis.map((kpi, i) => {
          const disp = kpiDisplay(metricFor(sponsor.id, i), kpi)
          return (
            <div key={i} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-secondary)]">
                  {kpi.description}
                </span>
                <span className={`text-[10px] font-mono ${kpi.met ? 'text-[var(--accent-lime)]' : 'text-[var(--text-dim)]'}`}>
                  {disp.label}
                </span>
              </div>
              <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{
                    width: `${disp.fill01 * 100}%`,
                    backgroundColor: kpi.met ? 'var(--accent-lime)' : 'var(--accent-cyan)',
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer: Satisfaction + Contract */}
      <div className="flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-dim)]">Satisfaction:</span>
          <div className="w-16 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{
                width: `${sponsor.satisfaction}%`,
                backgroundColor: sponsor.satisfaction > 60 ? 'var(--accent-lime)' :
                  sponsor.satisfaction > 30 ? 'var(--accent-amber)' : 'var(--accent-red)',
              }}
            />
          </div>
          <span className="font-mono text-[var(--text-secondary)]">{sponsor.satisfaction}%</span>
        </div>
        <div className="flex items-center gap-1">
          {isAtRisk && <Badge variant="red">At Risk</Badge>}
          <span className="font-mono text-[var(--text-dim)]">
            {seasonsRemaining > 0 ? `${seasonsRemaining}yr left` : 'Expiring'}
          </span>
        </div>
      </div>

      {/* Bonus info */}
      {allKpisMet && sponsor.bonusValue > 0 && (
        <div className="mt-2 text-[10px] font-mono text-[var(--accent-lime)]">
          Bonus earned: {formatMoney(sponsor.bonusValue)}
        </div>
      )}
    </div>
  )
}
