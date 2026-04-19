interface GapEntry {
  driverId: string
  driverName: string
  teamColor: string
  gap: number // seconds behind leader (0 for leader)
  isPlayer: boolean
}

interface GapChartProps {
  entries: GapEntry[]
  maxGap?: number
  className?: string
}

export function GapChart({ entries, maxGap, className = '' }: GapChartProps) {
  const max = maxGap ?? Math.max(...entries.map(e => e.gap), 1)

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {entries.map((entry, idx) => {
        const barWidth = entry.gap === 0 ? 100 : Math.max(3, (1 - entry.gap / max) * 100)

        return (
          <div key={entry.driverId} className="flex items-center gap-2">
            {/* Position label — axis label */}
            <span className="w-5 text-right font-mono text-[10px] text-ink-dim">
              P{idx + 1}
            </span>

            {/* Driver name — axis label */}
            <span className="w-10 font-mono text-[10px] text-ink-mute truncate">
              {entry.driverName}
            </span>

            {/* Bar track — grid line color */}
            <div className="flex-1 h-[3px] bg-line-hair rounded-[1px] overflow-hidden">
              <div
                className="h-full rounded-[1px] transition-[width] duration-300"
                style={{
                  width: `${barWidth}%`,
                  backgroundColor: entry.isPlayer ? 'var(--sig-red)' : entry.teamColor,
                  opacity: entry.isPlayer ? 1 : 0.65,
                }}
              />
            </div>

            {/* Gap value — axis label */}
            <span className="w-14 text-right font-mono text-[10px] text-ink-dim tabular-nums">
              {entry.gap === 0 ? 'LEAD' : `+${entry.gap.toFixed(1)}s`}
            </span>
          </div>
        )
      })}
    </div>
  )
}
