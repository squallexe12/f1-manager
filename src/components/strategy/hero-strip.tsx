'use client'

interface HeroStripProps {
  currentLap: number
  totalLaps: number
  leaderCode: string      // e.g. "NOR"
  leaderFirst: string     // e.g. "Lando"
  leaderLast: string      // e.g. "Norris"
  leaderNumber: number    // e.g. 4
  leaderTeamColor: string // hex from team data
  leaderTeamCode: string  // e.g. "MCL"
  leaderGap?: number      // gap leader → P2, seconds
  gapTrend?: 'closing' | 'growing' | 'stable'
}

export function HeroStrip({
  currentLap,
  totalLaps,
  leaderCode,
  leaderFirst,
  leaderLast,
  leaderNumber,
  leaderTeamColor,
  leaderTeamCode,
  leaderGap,
  gapTrend = 'stable',
}: HeroStripProps) {
  const lapPct = totalLaps > 0 ? (currentLap / totalLaps) * 100 : 0
  const gapLabel = typeof leaderGap === 'number' ? leaderGap.toFixed(3) : '—'
  const trendClass =
    gapTrend === 'closing' ? 'text-sig-red' :
    gapTrend === 'growing' ? 'text-sig-green' : 'text-ink-mute'

  return (
    <div className="grid gap-3 mb-3
                    grid-cols-1
                    min-[1200px]:grid-cols-[320px_1fr_280px]
                    min-[1400px]:grid-cols-[360px_1fr_300px]">

      {/* .lap-card — lap counter with progress bar */}
      <div className="relative overflow-hidden bg-surface-paper border border-line-sub rounded-rad p-5 flex flex-col gap-2.5">
        <span className="absolute top-0 left-0 bottom-0 w-1 bg-sig-red" />
        <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-dim">Current Lap</div>
        <div className="font-display font-extrabold text-[86px] leading-[0.88] tracking-[-0.04em] text-ink-hi tabular-nums flex items-baseline gap-2">
          {currentLap}
          <span className="text-[28px] font-medium text-ink-dim tracking-normal">/ {totalLaps}</span>
        </div>
        <div className="h-1 bg-surface-hi rounded-[2px] overflow-hidden">
          <div
            className="h-full bg-sig-red rounded-[2px]"
            style={{ width: `${lapPct}%`, transition: 'width 500ms ease' }}
          />
        </div>
        <div className="flex justify-between font-mono text-[10px] text-ink-mute tracking-[0.1em]">
          <span>START</span>
          <span>{Math.round(lapPct)}%</span>
          <span>FLAG</span>
        </div>
      </div>

      {/* .broadcast — leader callout */}
      <div className="relative grid grid-cols-[120px_1fr_auto] bg-surface-paper border border-line-sub rounded-rad overflow-hidden items-stretch">
        <div className="bg-sig-red text-surface-void flex items-center justify-center font-display font-extrabold text-[92px] leading-none tracking-[-0.08em] relative">
          1
          <span className="absolute top-2.5 right-2.5 font-mono text-[10px] tracking-[0.2em] opacity-60">P1</span>
        </div>
        <div className="px-5 py-3.5 flex flex-col justify-between gap-2 border-r border-line-hair">
          <div className="flex items-baseline gap-3">
            <span className="font-body font-light text-ink-mute text-[15px]">{leaderFirst}</span>
            <span className="font-display font-bold text-[30px] text-ink-hi tracking-[-0.02em] leading-none">{leaderLast}</span>
            <span className="ml-auto font-display font-extrabold text-[30px] text-ink-dim tracking-[-0.04em]">#{leaderNumber}</span>
          </div>
          <div className="flex gap-5 font-mono text-[11px]">
            <span>
              <span className="block font-mono text-[9px] uppercase tracking-[0.1em] text-ink-dim">Code</span>
              <span className="text-ink-hi font-semibold">{leaderCode}</span>
            </span>
          </div>
        </div>
        <div
          className="w-[68px] relative flex flex-col items-center justify-center gap-1.5 py-2.5 px-1.5"
          style={{ background: leaderTeamColor }}
        >
          <span className="font-display font-extrabold text-[18px] text-white tracking-[0.02em]">{leaderTeamCode}</span>
        </div>
      </div>

      {/* .gap-next — gap to P2 */}
      <div className="bg-surface-paper border border-line-sub rounded-rad px-4 py-3.5 flex flex-col gap-1.5 justify-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim">Gap to P2</div>
        <div className="font-display font-bold text-[38px] tracking-[-0.03em] text-ink-hi leading-none tabular-nums">
          <span className="text-sig-red text-[24px]">+</span>
          {gapLabel}
          <span className="text-ink-dim text-base ml-1 font-medium">s</span>
        </div>
        <div className={`font-mono text-[11px] inline-flex gap-1.5 items-center ${trendClass}`}>
          <span className="text-[10px]">{gapTrend === 'closing' ? '▼' : gapTrend === 'growing' ? '▲' : '—'}</span>
          <span className="uppercase tracking-[0.1em]">{gapTrend}</span>
        </div>
      </div>
    </div>
  )
}
