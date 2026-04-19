import type { BattleForecast as BattleForecastType } from '@/types/race'

interface BattleForecastProps {
  battles: BattleForecastType[]
  className?: string
}

export function BattleForecast({ battles, className = '' }: BattleForecastProps) {
  if (battles.length === 0) return null

  return (
    <div className={`flex flex-col bg-surface-paper border border-line-sub rounded-rad overflow-hidden ${className}`}>
      {/* Panel header */}
      <div className="px-3 py-2 border-b border-line-sub">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-dim">
          Battles
        </span>
      </div>

      {/* Battle rows — 1px line-hair separator grid */}
      <div className="flex flex-col gap-px bg-line-hair">
        {battles.map((battle) => {
          const pct = Math.round(battle.overtakeProbability * 100)
          // Gap direction: 'Closing fast' matches 'clos'; 'DRS range' (<0.5s) also treated as closing
          const desc = battle.description.toLowerCase()
          const isClosing = desc.includes('clos') || desc.includes('drs')

          return (
            <div
              key={`${battle.attackerId}-${battle.defenderId}`}
              className="bg-surface-paper px-3.5 py-2.5 grid items-center gap-2.5"
              style={{ gridTemplateColumns: '1fr auto 1fr' }}
            >
              {/* Attacker (left) */}
              <div className="flex items-center gap-2">
                <div className="w-[3px] h-4 rounded-[1px] bg-sig-red shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-display font-bold text-[13px] text-ink-hi tracking-[0.02em] truncate uppercase">
                    {battle.attackerId.toUpperCase()}
                  </span>
                  <span className="font-mono text-[9px] text-ink-dim uppercase tracking-[0.1em]">
                    ATK
                  </span>
                </div>
              </div>

              {/* Center gap + delta */}
              <div className="flex flex-col items-center gap-0.5">
                <span className="font-mono font-semibold text-[13px] text-ink-hi tabular-nums">
                  {pct}%
                </span>
                <span
                  className={`font-mono text-[9px] font-bold uppercase tracking-[0.12em] ${
                    isClosing ? 'text-sig-red' : 'text-sig-green'
                  }`}
                >
                  {isClosing ? '▼ CLOSING' : '▲ GROWING'}
                </span>
                <span className="font-mono text-[9px] text-ink-dim">
                  ~{battle.estimatedLaps}L
                </span>
              </div>

              {/* Defender (right) */}
              <div className="flex items-center gap-2 justify-end">
                <div className="flex flex-col items-end min-w-0">
                  <span className="font-display font-bold text-[13px] text-ink-hi tracking-[0.02em] truncate uppercase">
                    {battle.defenderId.toUpperCase()}
                  </span>
                  <span className="font-mono text-[9px] text-ink-dim uppercase tracking-[0.1em]">
                    DEF
                  </span>
                </div>
                <div className="w-[3px] h-4 rounded-[1px] bg-ink-dim shrink-0" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
