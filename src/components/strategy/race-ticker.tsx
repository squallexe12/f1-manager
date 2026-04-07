'use client'

import type { CommentaryEntry } from '@/types/race'

interface RaceTickerProps {
  entries: CommentaryEntry[]
  className?: string
}

export function RaceTicker({ entries, className = '' }: RaceTickerProps) {
  // Show only last 3 important events (not neutral)
  const highlights = entries
    .filter(e => e.severity !== 'neutral')
    .slice(-3)
    .reverse()

  if (highlights.length === 0) return null

  return (
    <div className={`flex gap-3 overflow-x-auto ${className}`}>
      {highlights.map((entry, i) => {
        const color = entry.severity === 'critical' ? 'var(--accent-red)'
          : entry.severity === 'highlight' ? 'var(--accent-lime)'
          : entry.severity === 'radio' ? 'var(--accent-purple)'
          : 'var(--accent-cyan)'

        return (
          <div
            key={`${entry.lap}-${i}`}
            className="flex items-center gap-2 shrink-0 px-3 py-1.5 rounded-md bg-white/[0.03] border border-white/[0.06]"
          >
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="text-[10px] font-mono text-[var(--text-dim)] shrink-0">L{entry.lap}</span>
            <span className="text-[10px] text-[var(--text-secondary)] whitespace-nowrap">{entry.text}</span>
          </div>
        )
      })}
    </div>
  )
}
