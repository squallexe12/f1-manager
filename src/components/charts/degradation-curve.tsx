interface DegradationCurveProps {
  /** Array of wear values (0-100) per lap */
  wearData: number[]
  /** Current lap index (0-based) */
  currentLap: number
  /** Lap range for pit window [start, end] */
  pitWindow?: [number, number]
  /** Tire compound color */
  compoundColor?: string
  /** Label for the compound */
  compoundLabel?: string
  className?: string
}

const COMPOUND_COLORS: Record<string, string> = {
  hard: '#FFFFFF',
  medium: '#FFC800',
  soft: '#FF3B30',
}

export function DegradationCurve({
  wearData,
  currentLap,
  pitWindow,
  compoundColor,
  compoundLabel = '',
  className = '',
}: DegradationCurveProps) {
  const color = compoundColor ?? COMPOUND_COLORS[compoundLabel.toLowerCase()] ?? 'var(--accent-cyan)'
  const width = 280
  const height = 100
  const padding = { top: 8, right: 12, bottom: 20, left: 28 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const totalLaps = wearData.length
  if (totalLaps === 0) return null

  const xScale = (lap: number) => padding.left + (lap / Math.max(1, totalLaps - 1)) * chartW
  const yScale = (wear: number) => padding.top + (1 - wear / 100) * chartH

  // Build SVG path
  const points = wearData.map((wear, i) => `${xScale(i)},${yScale(wear)}`).join(' ')
  const areaPath = `M${xScale(0)},${yScale(wearData[0])} ${points.split(' ').map(p => `L${p}`).join(' ')} L${xScale(totalLaps - 1)},${yScale(0)} L${xScale(0)},${yScale(0)} Z`
  const linePath = `M${points.split(' ').join(' L')}`

  const currentWear = currentLap < totalLaps ? wearData[currentLap] : wearData[totalLaps - 1]

  return (
    <div
      className={className}
      role="img"
      aria-label={`Tire degradation curve. ${compoundLabel} compound. Current wear: ${Math.round(currentWear ?? 0)}% at lap ${currentLap}`}
    >
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" aria-hidden="true">
        <defs>
          <linearGradient id={`grad-${compoundLabel}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(v => (
          <line
            key={v}
            x1={padding.left} y1={yScale(v)}
            x2={width - padding.right} y2={yScale(v)}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="2 3"
          />
        ))}

        {/* Pit window */}
        {pitWindow && (
          <rect
            x={xScale(pitWindow[0])} y={padding.top}
            width={xScale(pitWindow[1]) - xScale(pitWindow[0])}
            height={chartH}
            fill="var(--accent-cyan)" opacity="0.08"
          />
        )}

        {/* Cliff zone (below 15%) */}
        <rect
          x={padding.left} y={yScale(15)}
          width={chartW} height={yScale(0) - yScale(15)}
          fill="var(--accent-red)" opacity="0.06"
        />

        {/* Area + Line */}
        <path d={areaPath} fill={`url(#grad-${compoundLabel})`} />
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Current lap marker */}
        {currentLap < totalLaps && (
          <circle
            cx={xScale(currentLap)}
            cy={yScale(wearData[currentLap])}
            r="3" fill={color}
          />
        )}

        {/* Y axis labels */}
        {[0, 50, 100].map(v => (
          <text
            key={v}
            x={padding.left - 4} y={yScale(v) + 3}
            textAnchor="end"
            fill="var(--text-dim)" fontSize="8" fontFamily="var(--font-mono)"
          >
            {v}%
          </text>
        ))}

        {/* X axis label */}
        <text
          x={width / 2} y={height - 2}
          textAnchor="middle"
          fill="var(--text-dim)" fontSize="8" fontFamily="var(--font-heading)"
        >
          LAPS
        </text>
      </svg>
    </div>
  )
}
