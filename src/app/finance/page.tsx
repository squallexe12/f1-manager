'use client'

import { useRequireGame } from '@/hooks/use-require-game'
import { PageShell } from '@/components/layout/page-shell'
import { BudgetTracker } from '@/components/finance/budget-tracker'
import { SponsorCard } from '@/components/finance/sponsor-card'
import { PrestigeMeter } from '@/components/finance/prestige-meter'

function formatMoney(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  return `$${(value / 1_000).toFixed(0)}K`
}

export default function FinancePage() {
  const world = useRequireGame()

  if (!world) return null

  const { gameState, teams } = world
  const playerTeam = teams.find((t) => t.id === gameState.playerTeamId)!
  const finance = world.finance[playerTeam.id]

  const sponsorsByTier = {
    title: finance.sponsors.filter(s => s.tier === 'title'),
    major: finance.sponsors.filter(s => s.tier === 'major'),
    minor: finance.sponsors.filter(s => s.tier === 'minor'),
  }

  const totalSponsorIncome = finance.sponsors.reduce((sum, s) => sum + s.annualValue, 0)

  return (
    <PageShell>
      {/* Budget Tracker — Full Width */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4 mb-6">
        <BudgetTracker budget={finance.budget} />
      </div>

      {/* Two Columns: Sponsors | Prestige + Revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Sponsors */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <h2 className="text-sm font-heading font-bold uppercase tracking-wider text-[var(--text-primary)]">
            Sponsors
          </h2>

          {/* Total income summary */}
          <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
            <span>Total Annual Income: <span className="font-mono text-[var(--accent-lime)]">{formatMoney(totalSponsorIncome)}</span></span>
            <span className="text-[var(--text-dim)]">|</span>
            <span>Prize Money Est: <span className="font-mono text-[var(--accent-cyan)]">{formatMoney(finance.prizeMoneyEstimate)}</span></span>
            <span className="text-[var(--text-dim)]">|</span>
            <span>Bonuses Banked: <span className="font-mono text-[var(--accent-lime)]">{formatMoney(finance.bankedBonuses)}</span></span>
          </div>

          {/* Title Sponsors */}
          {sponsorsByTier.title.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-heading uppercase tracking-wider text-[var(--text-dim)]">Title Sponsors</span>
              {sponsorsByTier.title.map(s => (
                <SponsorCard key={s.id} sponsor={s} currentSeason={gameState.season} />
              ))}
            </div>
          )}

          {/* Major Sponsors */}
          {sponsorsByTier.major.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-heading uppercase tracking-wider text-[var(--text-dim)]">Major Sponsors</span>
              {sponsorsByTier.major.map(s => (
                <SponsorCard key={s.id} sponsor={s} currentSeason={gameState.season} />
              ))}
            </div>
          )}

          {/* Minor Sponsors */}
          {sponsorsByTier.minor.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-heading uppercase tracking-wider text-[var(--text-dim)]">Minor Sponsors</span>
              {sponsorsByTier.minor.map(s => (
                <SponsorCard key={s.id} sponsor={s} currentSeason={gameState.season} />
              ))}
            </div>
          )}

          {finance.sponsors.length === 0 && (
            <p className="text-xs text-[var(--text-dim)] italic">No active sponsors. Improve your prestige to attract sponsors.</p>
          )}
        </div>

        {/* Right: Prestige + Marketing */}
        <div className="flex flex-col gap-6">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4">
            <PrestigeMeter rating={finance.prestige} score={finance.prestigeScore} />
          </div>

          {/* Marketing Budget */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4">
            <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)] mb-3">
              Marketing
            </h3>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-xs text-[var(--text-secondary)]">Budget</span>
              <span className="text-sm font-mono text-[var(--accent-purple)]">
                {formatMoney(finance.marketingBudget)}
              </span>
            </div>
            <p className="text-[10px] text-[var(--text-dim)]">
              Marketing spend improves prestige score and sponsor appeal. Higher prestige unlocks premium sponsors.
            </p>
          </div>

          {/* Revenue Breakdown */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4">
            <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)] mb-3">
              Revenue Summary
            </h3>
            <div className="flex flex-col gap-2">
              <RevenueRow label="Sponsor Income" value={totalSponsorIncome} color="var(--accent-lime)" />
              <RevenueRow label="Prize Money (est.)" value={finance.prizeMoneyEstimate} color="var(--accent-cyan)" />
              <RevenueRow label="Marketing" value={finance.marketingBudget} color="var(--accent-purple)" />
              <div className="border-t border-[var(--border-default)] pt-2 mt-1">
                <RevenueRow
                  label="Total Revenue"
                  value={totalSponsorIncome + finance.prizeMoneyEstimate}
                  color="var(--text-primary)"
                  bold
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  )
}

function RevenueRow({ label, value, color, bold = false }: { label: string; value: number; color: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-[10px] ${bold ? 'font-heading font-semibold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
        {label}
      </span>
      <span className={`text-xs font-mono ${bold ? 'font-bold' : ''}`} style={{ color }}>
        {formatMoney(value)}
      </span>
    </div>
  )
}
