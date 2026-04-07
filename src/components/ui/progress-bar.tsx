interface ProgressBarProps {
  value: number // 0-100
  color?: string
  label?: string
  className?: string
}

export function ProgressBar({ value, color = 'var(--accent-lime)', label, className = '' }: ProgressBarProps) {
  const clampedValue = Math.max(0, Math.min(100, value))

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <div className="flex justify-between mb-1">
          <span className="text-xs text-[var(--text-secondary)]">{label}</span>
          <span className="text-xs font-mono text-[var(--text-muted)]">{Math.round(clampedValue)}%</span>
        </div>
      )}
      <div className="h-1 w-full bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${clampedValue}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
