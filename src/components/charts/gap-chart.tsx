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
            <span className="w-5 text-right text-[10px] font-mono text-[var(--text-dim)]">
              P{idx + 1}
            </span>
            <span className="w-10 text-xs font-heading text-[var(--text-secondary)] truncate">
              {entry.driverName}
            </span>
            <div className="flex-1 h-3 bg-white/[0.03] rounded-sm overflow-hidden">
              <div
                className="h-full rounded-sm transition-[width] duration-300"
                style={{
                  width: `${barWidth}%`,
                  backgroundColor: entry.isPlayer ? 'var(--accent-lime)' : entry.teamColor,
                  opacity: entry.isPlayer ? 1 : 0.6,
                }}
              />
            </div>
            <span className="w-14 text-right text-[10px] font-mono text-[var(--text-muted)]">
              {entry.gap === 0 ? 'LEADER' : `+${entry.gap.toFixed(1)}s`}
            </span>
          </div>
        )
      })}
    </div>
  )
}
