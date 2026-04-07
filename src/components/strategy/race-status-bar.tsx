import type { WeatherForecast } from '@/types/race'
import { Badge } from '@/components/ui/badge'

interface RaceStatusBarProps {
  lap: number
  totalLaps: number
  weather: WeatherForecast
  trackTemp: number
  safetyCar: 'green' | 'vsc' | 'sc'
  className?: string
}

const SC_BADGE: Record<string, { label: string; variant: 'lime' | 'amber' | 'red' }> = {
  green: { label: 'Green', variant: 'lime' },
  vsc: { label: 'VSC', variant: 'amber' },
  sc: { label: 'Safety Car', variant: 'red' },
}

const WEATHER_ICON: Record<string, string> = {
  dry: '☀',
  damp: '🌥',
  wet: '🌧',
}

export function RaceStatusBar({ lap, totalLaps, weather, trackTemp, safetyCar, className = '' }: RaceStatusBarProps) {
  const sc = SC_BADGE[safetyCar]

  return (
    <div
      className={`flex items-center gap-4 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg px-4 py-2 ${className}`}
      role="status"
      aria-label={`Lap ${lap} of ${totalLaps}. Weather: ${weather.current}. Track temp: ${Math.round(trackTemp)}°C. ${sc.label}`}
      aria-live={safetyCar !== 'green' ? 'assertive' : 'polite'}
    >
      {/* Lap counter */}
      <div className="text-sm font-mono text-[var(--text-primary)]">
        <span className="text-[var(--accent-lime)]">{lap}</span>
        <span className="text-[var(--text-dim)]">/{totalLaps}</span>
      </div>

      <div className="w-px h-5 bg-[var(--border-default)]" />

      {/* Weather */}
      <div className="flex items-center gap-1.5">
        <span className="text-sm">{WEATHER_ICON[weather.current] ?? '☀'}</span>
        <span className="text-[10px] font-mono text-[var(--text-secondary)]">
          Rain: {Math.round(weather.rainProbability * 100)}%
        </span>
      </div>

      <div className="w-px h-5 bg-[var(--border-default)]" />

      {/* Track temp */}
      <span className="text-[10px] font-mono text-[var(--text-secondary)]">
        Track: {Math.round(trackTemp)}°C
      </span>

      <div className="w-px h-5 bg-[var(--border-default)]" />

      {/* Safety car */}
      <Badge variant={sc.variant}>{sc.label}</Badge>
    </div>
  )
}
