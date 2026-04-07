import type { Mood } from '@/types/driver'
import { ProgressBar } from '@/components/ui/progress-bar'

interface MoodTrackerProps {
  mood: Mood
  className?: string
}

const MOOD_CONFIG = [
  { key: 'motivation' as const, label: 'Motivation', goodHigh: true },
  { key: 'frustration' as const, label: 'Frustration', goodHigh: false },
  { key: 'confidence' as const, label: 'Confidence', goodHigh: true },
]

function getMoodColor(value: number, goodHigh: boolean): string {
  if (goodHigh) {
    if (value >= 75) return 'var(--accent-lime)'
    if (value >= 40) return 'var(--accent-amber)'
    return 'var(--accent-red)'
  }
  // For frustration (high = bad)
  if (value <= 30) return 'var(--accent-lime)'
  if (value <= 60) return 'var(--accent-amber)'
  return 'var(--accent-red)'
}

function getMoodText(value: number, goodHigh: boolean): string {
  if (goodHigh) {
    if (value >= 80) return 'Excellent'
    if (value >= 60) return 'Good'
    if (value >= 40) return 'Average'
    return 'Poor'
  }
  if (value <= 20) return 'Calm'
  if (value <= 40) return 'Mild'
  if (value <= 60) return 'Building'
  return 'Critical'
}

export function MoodTracker({ mood, className = '' }: MoodTrackerProps) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)]">
        Mood
      </h3>
      {MOOD_CONFIG.map(({ key, label, goodHigh }) => {
        const value = mood[key]
        const color = getMoodColor(value, goodHigh)
        const text = getMoodText(value, goodHigh)

        return (
          <div key={key}>
            <div className="flex justify-between mb-0.5">
              <span className="text-xs text-[var(--text-secondary)]">{label}</span>
              <span className="text-[10px] font-mono" style={{ color }}>{text}</span>
            </div>
            <ProgressBar value={value} color={color} />
          </div>
        )
      })}
    </div>
  )
}
