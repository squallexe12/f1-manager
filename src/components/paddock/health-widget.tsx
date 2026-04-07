interface HealthWidgetProps {
  label: string
  value: string | number
  trend?: 'up' | 'down' | 'stable'
  warning?: string
  color?: string
  className?: string
}

const TREND_ICONS: Record<string, string> = {
  up: '↑',
  down: '↓',
  stable: '→',
}

const TREND_COLORS: Record<string, string> = {
  up: 'text-[var(--accent-lime)]',
  down: 'text-[var(--accent-red)]',
  stable: 'text-[var(--text-dim)]',
}

export function HealthWidget({ label, value, trend, warning, color, className = '' }: HealthWidgetProps) {
  return (
    <div className={`bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-3 ${className}`}>
      <div className="text-[10px] font-heading uppercase tracking-wider text-[var(--text-muted)] mb-1">
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          className="text-xl font-heading font-bold"
          style={{ color: color ?? 'var(--text-primary)' }}
        >
          {value}
        </span>
        {trend && (
          <span className={`text-xs font-mono ${TREND_COLORS[trend]}`}>
            {TREND_ICONS[trend]}
          </span>
        )}
      </div>
      {warning && (
        <div className="text-[10px] text-[var(--accent-amber)] mt-1">{warning}</div>
      )}
    </div>
  )
}
