import type { BattleForecast as BattleForecastType } from '@/types/race'

interface BattleForecastProps {
  battles: BattleForecastType[]
  className?: string
}

export function BattleForecast({ battles, className = '' }: BattleForecastProps) {
  if (battles.length === 0) return null

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)]">
        Battles
      </h3>
      {battles.map((battle, i) => (
        <div key={i} className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md p-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-heading text-[var(--text-secondary)]">
              {battle.attackerId.toUpperCase()} → {battle.defenderId.toUpperCase()}
            </span>
            <span className="text-[10px] font-mono text-[var(--accent-lime)]">
              {Math.round(battle.overtakeProbability * 100)}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--accent-lime)]"
              style={{ width: `${battle.overtakeProbability * 100}%` }}
            />
          </div>
          <div className="text-[9px] text-[var(--text-dim)] mt-0.5">
            ~{battle.estimatedLaps} laps · {battle.description}
          </div>
        </div>
      ))}
    </div>
  )
}
