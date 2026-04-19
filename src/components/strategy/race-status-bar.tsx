'use client'

import type { WeatherForecast } from '@/types/race'

interface RaceStatusBarProps {
  lap: number
  totalLaps: number
  weather: WeatherForecast
  trackTemp: number
  safetyCar: 'green' | 'vsc' | 'sc'
  className?: string
}

const SC_CONFIG: Record<string, { label: string; accentClass: string }> = {
  green: { label: 'GREEN', accentClass: 'text-sig-green' },
  vsc: { label: 'VSC', accentClass: 'text-sig-amber' },
  sc: { label: 'SAFETY CAR', accentClass: 'text-sig-red' },
}

const WEATHER_ICON: Record<string, string> = {
  dry: '☀',
  damp: '🌥',
  wet: '🌧',
}

export function RaceStatusBar({ lap, totalLaps, weather, trackTemp, safetyCar, className = '' }: RaceStatusBarProps) {
  const sc = SC_CONFIG[safetyCar]

  return (
    <div
      className={`flex items-center gap-6 bg-surface-paper border border-line-sub rounded-rad px-4 py-2 ${className}`}
      role="status"
      aria-label={`Lap ${lap} of ${totalLaps}. Weather: ${weather.current}. Track temp: ${Math.round(trackTemp)}°C. ${sc.label}`}
      aria-live={safetyCar !== 'green' ? 'assertive' : 'polite'}
    >
      {/* Lap counter — .stat */}
      <div className="flex flex-col gap-0.5 items-center">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-dim">Lap</span>
        <span className="font-mono font-semibold text-[14px] text-ink-hi tabular-nums">
          <span className="text-sig-red">{lap}</span>
          <span className="text-ink-dim">/{totalLaps}</span>
        </span>
      </div>

      <div className="w-px h-6 bg-line-hair" />

      {/* Weather — .stat */}
      <div className="flex flex-col gap-0.5 items-center">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-dim">Weather</span>
        <span className="font-mono font-semibold text-[14px] text-ink-hi">
          {WEATHER_ICON[weather.current] ?? '☀'}
          <span className="text-[11px] text-ink-mute ml-1">{Math.round(weather.rainProbability * 100)}%</span>
        </span>
      </div>

      <div className="w-px h-6 bg-line-hair" />

      {/* Track temp — .stat */}
      <div className="flex flex-col gap-0.5 items-center">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-dim">Track</span>
        <span className="font-mono font-semibold text-[14px] text-ink-hi tabular-nums">{Math.round(trackTemp)}°C</span>
      </div>

      <div className="w-px h-6 bg-line-hair" />

      {/* Flag status — .stat */}
      <div className="flex flex-col gap-0.5 items-center">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-dim">Flag</span>
        <span className={`font-mono font-semibold text-[11px] uppercase tracking-[0.1em] ${sc.accentClass}`}>{sc.label}</span>
      </div>
    </div>
  )
}
