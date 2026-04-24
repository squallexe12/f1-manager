interface FactoryHeaderProps {
  teamName: string
  location: string
  round: number
  budgetCap: number
  budgetSpent: number
}

function formatM(v: number): string {
  return `$${v.toFixed(1).replace(/\.0$/, '')}M`
}

export function FactoryHeader({ teamName, location, round, budgetCap, budgetSpent }: FactoryHeaderProps) {
  const remaining = Math.max(0, budgetCap - budgetSpent)
  return (
    <div className="fac-headbar">
      <div className="fac-headbar-left">
        <div className="fac-crumb">
          ◉ FACTORY · {location.toUpperCase()} · ROUND {String(round).padStart(2, '0')}
        </div>
        <div className="fac-title">R&amp;D Command</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em', color: 'var(--ink-dim)', textTransform: 'uppercase', marginTop: 4 }}>
          {teamName}
        </div>
      </div>
      <div className="fac-headbar-budget">
        <div className="fac-b-cell">
          <div className="k">Budget Cap</div>
          <div className="v">{formatM(budgetCap)}</div>
        </div>
        <div className="fac-b-cell">
          <div className="k">Spent</div>
          <div className="v amber">{formatM(budgetSpent)}</div>
        </div>
        <div className="fac-b-cell">
          <div className="k">Remaining</div>
          <div className="v green">{formatM(remaining)}</div>
        </div>
      </div>
    </div>
  )
}
