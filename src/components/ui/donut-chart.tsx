interface DonutChartProps {
  percentage: number // 0-100
  color?: string
  size?: number
  strokeWidth?: number
  label?: string
  sublabel?: string
  className?: string
}

export function DonutChart({
  percentage,
  color = 'var(--accent-cyan)',
  size = 80,
  strokeWidth = 6,
  label,
  sublabel,
  className = '',
}: DonutChartProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      {label && <span className="text-xs font-heading text-[var(--text-primary)]">{label}</span>}
      {sublabel && <span className="text-[10px] text-[var(--text-muted)]">{sublabel}</span>}
    </div>
  )
}
