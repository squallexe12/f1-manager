import type { Contract } from '@/types/driver'

interface ContractPanelProps {
  contract: Contract | null
  driverName: string
  className?: string
}

export function ContractPanel({ contract, driverName, className = '' }: ContractPanelProps) {
  if (!contract) {
    return (
      <div className={`bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-3 ${className}`}>
        <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)] mb-2">Contract</h3>
        <p className="text-xs text-[var(--text-dim)] italic">No active contract — Free Agent</p>
      </div>
    )
  }

  return (
    <div className={`bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-3 ${className}`}>
      <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)] mb-3">
        Contract
      </h3>

      <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
        <div>
          <span className="text-[var(--text-dim)]">Salary</span>
          <div className="font-mono text-[var(--text-primary)]">
            ${(contract.salary / 1_000_000).toFixed(1)}M/yr
          </div>
        </div>
        <div>
          <span className="text-[var(--text-dim)]">Expires</span>
          <div className="font-mono text-[var(--text-primary)]">
            {contract.termEndSeason === 1
              ? <span className="text-[var(--accent-amber)]">End of season</span>
              : `${contract.termEndSeason} seasons`
            }
          </div>
        </div>
        {contract.releaseClause && (
          <div>
            <span className="text-[var(--text-dim)]">Release Clause</span>
            <div className="font-mono text-[var(--text-secondary)]">
              ${(contract.releaseClause / 1_000_000).toFixed(0)}M
            </div>
          </div>
        )}
      </div>

      {contract.performanceBonuses.length > 0 && (
        <div className="mt-3 border-t border-[var(--border-default)] pt-2">
          <span className="text-[10px] text-[var(--text-dim)] uppercase">Bonuses</span>
          {contract.performanceBonuses.map((bonus, i) => (
            <div key={i} className="text-[10px] text-[var(--text-secondary)] mt-0.5">
              {bonus.condition}: <span className="font-mono text-[var(--accent-lime)]">${(bonus.value / 1_000_000).toFixed(1)}M</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
