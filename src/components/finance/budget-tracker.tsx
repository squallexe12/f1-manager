'use client'

import type { Budget } from '@/types/finance'
import { Badge } from '@/components/ui/badge'

interface BudgetTrackerProps {
  budget: Budget
  className?: string
}

const CATEGORY_COLORS: Record<string, string> = {
  'R&D': 'var(--accent-cyan)',
  'Salaries': 'var(--accent-lime)',
  'Operations': 'var(--accent-amber)',
  'Marketing': 'var(--accent-purple)',
}

function formatMoney(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value}`
}

export function BudgetTracker({ budget, className = '' }: BudgetTrackerProps) {
  const spentPercent = Math.min(100, (budget.totalSpent / budget.cap) * 100)
  const projectedPercent = Math.min(100, (budget.projectedEndOfSeason / budget.cap) * 100)
  const remaining = budget.cap - budget.totalSpent

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)]">
          Budget Cap
        </h3>
        {budget.penaltyRisk && (
          <Badge variant="red">Cap Risk</Badge>
        )}
      </div>

      {/* Main bar */}
      <div>
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-lg font-mono font-bold text-[var(--text-primary)]">
            {formatMoney(budget.totalSpent)}
          </span>
          <span className="text-xs font-mono text-[var(--text-dim)]">
            / {formatMoney(budget.cap)}
          </span>
        </div>

        <div className="relative h-4 bg-white/[0.04] rounded-full overflow-hidden">
          {/* Category segments (stacked) */}
          <div className="absolute inset-0 flex rounded-full overflow-hidden">
            {budget.categories.map((cat) => {
              const catPercent = (cat.spent / budget.cap) * 100
              return (
                <div
                  key={cat.name}
                  className="h-full transition-[width] duration-500"
                  style={{
                    width: `${catPercent}%`,
                    backgroundColor: CATEGORY_COLORS[cat.name] ?? 'var(--text-dim)',
                    opacity: 0.8,
                  }}
                />
              )
            })}
          </div>

          {/* Projected end-of-season marker */}
          {projectedPercent > spentPercent && (
            <div
              className="absolute top-0 h-full w-0.5 bg-white/30"
              style={{ left: `${projectedPercent}%` }}
              title={`Projected: ${formatMoney(budget.projectedEndOfSeason)}`}
            />
          )}

          {/* Danger zone (90%+) */}
          <div
            className="absolute top-0 right-0 h-full bg-[var(--accent-red)]/10"
            style={{ width: '10%' }}
          />
        </div>

        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] font-mono text-[var(--text-dim)]">
            {spentPercent.toFixed(1)}% used
          </span>
          <span className={`text-[10px] font-mono ${remaining < 20_000_000 ? 'text-[var(--accent-red)]' : 'text-[var(--text-secondary)]'}`}>
            {formatMoney(remaining)} remaining
          </span>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {budget.categories.map((cat) => (
          <div key={cat.name} className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: CATEGORY_COLORS[cat.name] ?? 'var(--text-dim)' }}
              />
              <span className="text-[10px] font-heading uppercase tracking-wider text-[var(--text-dim)]">
                {cat.name}
              </span>
            </div>
            <span className="text-xs font-mono text-[var(--text-secondary)]">
              {formatMoney(cat.spent)}
            </span>
            <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${cat.allocated > 0 ? (cat.spent / cat.allocated) * 100 : 0}%`,
                  backgroundColor: CATEGORY_COLORS[cat.name] ?? 'var(--text-dim)',
                }}
              />
            </div>
            <span className="text-[9px] font-mono text-[var(--text-dim)]">
              / {formatMoney(cat.allocated)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
