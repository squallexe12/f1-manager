import type { Sponsor } from '@/types/finance'
import { Badge } from '@/components/ui/badge'

interface SponsorCardProps {
  sponsor: Sponsor
  currentSeason: number
  className?: string
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
  const isAtRisk = sponsor.satisfaction < 40
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
        {sponsor.kpis.map((kpi, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--text-secondary)]">
                {kpi.description}
              </span>
              <span className={`text-[10px] font-mono ${kpi.met ? 'text-[var(--accent-lime)]' : 'text-[var(--text-dim)]'}`}>
                {kpi.current}/{kpi.target}
              </span>
            </div>
            <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{
                  width: `${Math.min(100, (kpi.current / kpi.target) * 100)}%`,
                  backgroundColor: kpi.met ? 'var(--accent-lime)' : 'var(--accent-cyan)',
                }}
              />
            </div>
          </div>
        ))}
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
