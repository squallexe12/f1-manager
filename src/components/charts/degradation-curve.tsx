import type { TireCompound } from '@/types/race'

interface DegradationCurveProps {
  /** Array of wear values (0-100) per lap */
  wearData: number[]
  /** Compound fitted at each lap (parallel to wearData). Drives per-stint coloring. */
  compoundData?: TireCompound[]
  /** Current lap index (0-based) */
  currentLap: number
  /** Lap range for pit window [start, end] */
  pitWindow?: [number, number]
  /** Fallback solid color when no compoundData is supplied */
  compoundColor?: string
  /** Legacy label-based fallback (hard/medium/soft) */
  compoundLabel?: string
  className?: string
}

// Pirelli compound colors — hard=white, medium=yellow, soft=red
const COMPOUND_HEX: Record<TireCompound, string> = {
  C1: '#FFFFFF',
  C2: '#FFFFFF',
  C3: '#FFC800',
  C4: '#FF3B30',
  C5: '#FF3B30',
}

const LEGACY_LABEL_HEX: Record<string, string> = {
  hard: '#FFFFFF',
  medium: '#FFC800',
  soft: '#FF3B30',
}

interface Stint {
  startIdx: number
  endIdx: number // inclusive
  compound: TireCompound
}

function buildStints(compounds: TireCompound[]): Stint[] {
  if (compounds.length === 0) return []
  const stints: Stint[] = []
  let startIdx = 0
  for (let i = 1; i < compounds.length; i++) {
    if (compounds[i] !== compounds[startIdx]) {
      stints.push({ startIdx, endIdx: i - 1, compound: compounds[startIdx] })
      startIdx = i
    }
  }
  stints.push({ startIdx, endIdx: compounds.length - 1, compound: compounds[startIdx] })
  return stints
}

export function DegradationCurve({
  wearData,
  compoundData,
  currentLap,
  pitWindow,
  compoundColor,
  compoundLabel = '',
  className = '',
}: DegradationCurveProps) {
  const fallbackColor =
    compoundColor ?? LEGACY_LABEL_HEX[compoundLabel.toLowerCase()] ?? 'var(--accent-cyan)'
  const width = 280
  const height = 100
  const padding = { top: 8, right: 12, bottom: 20, left: 28 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const totalLaps = wearData.length
  if (totalLaps === 0) return null

  const xScale = (lap: number) => padding.left + (lap / Math.max(1, totalLaps - 1)) * chartW
  const yScale = (wear: number) => padding.top + (1 - wear / 100) * chartH

  const stints: Stint[] = compoundData && compoundData.length === totalLaps
    ? buildStints(compoundData)
    : [{ startIdx: 0, endIdx: totalLaps - 1, compound: 'C3' }]
  const useCompoundColors = Boolean(compoundData && compoundData.length === totalLaps)

  const currentWear = currentLap < totalLaps ? wearData[currentLap] : wearData[totalLaps - 1]
  const currentCompound = compoundData && currentLap < compoundData.length
    ? compoundData[currentLap]
    : compoundData?.[compoundData.length - 1]
  const currentDotColor = useCompoundColors && currentCompound
    ? COMPOUND_HEX[currentCompound]
    : fallbackColor

  return (
    <div
      className={className}
      role="img"
      aria-label={`Tire degradation curve. ${compoundLabel} compound. Current wear: ${Math.round(currentWear ?? 0)}% at lap ${currentLap}`}
    >
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" aria-hidden="true">
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

        {/* Per-stint segments — each stint gets its compound color */}
        {stints.map((stint, idx) => {
          const color = useCompoundColors ? COMPOUND_HEX[stint.compound] : fallbackColor
          const pts: string[] = []
          for (let i = stint.startIdx; i <= stint.endIdx; i++) {
            pts.push(`${xScale(i)},${yScale(wearData[i])}`)
          }
          // Vertical drop at stint boundary visually communicates the pit reset
          if (pts.length === 1) {
            return (
              <circle
                key={idx}
                cx={xScale(stint.startIdx)}
                cy={yScale(wearData[stint.startIdx])}
                r="1.5"
                fill={color}
              />
            )
          }
          return (
            <polyline
              key={idx}
              points={pts.join(' ')}
              fill="none"
              stroke={color}
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          )
        })}

        {/* Stint boundary markers (pit laps) */}
        {useCompoundColors && stints.slice(1).map((stint, idx) => (
          <line
            key={`boundary-${idx}`}
            x1={xScale(stint.startIdx)}
            y1={padding.top}
            x2={xScale(stint.startIdx)}
            y2={padding.top + chartH}
            stroke="rgba(255,255,255,0.25)"
            strokeDasharray="2 2"
            strokeWidth="1"
          />
        ))}

        {/* Current lap marker */}
        {currentLap < totalLaps && (
          <circle
            cx={xScale(currentLap)}
            cy={yScale(wearData[currentLap])}
            r="3"
            fill={currentDotColor}
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
