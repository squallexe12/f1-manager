'use client'

import type { CommentaryEntry } from '@/types/race'

interface RaceTickerProps {
  entries: CommentaryEntry[]
  className?: string
}

/** Map severity → flag-marker background + text classes (Broadcast palette) */
function flagMarkerClass(severity: CommentaryEntry['severity']): string {
  switch (severity) {
    case 'critical': return 'bg-sig-red text-surface-void'
    case 'highlight': return 'bg-sig-green text-surface-void'
    case 'radio': return 'bg-sig-purple text-surface-void'
    default: return 'bg-sig-amber text-surface-void'
  }
}

function flagLabel(severity: CommentaryEntry['severity']): string {
  switch (severity) {
    case 'critical': return 'RED'
    case 'highlight': return 'GREEN'
    case 'radio': return 'RADIO'
    default: return 'INFO'
  }
}

export function RaceTicker({ entries, className = '' }: RaceTickerProps) {
  // Last up-to-3 non-neutral events, newest first
  const highlights = entries
    .filter(e => e.severity !== 'neutral')
    .slice(-3)
    .reverse()

  if (highlights.length === 0) return null

  // Duplicate for seamless scroll loop
  const doubled = [...highlights, ...highlights]

  return (
    <>
      {/* Scoped keyframe — no globals.css or tailwind.config.ts modification needed */}
      <style>{`
        @keyframes ticker-roll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .ticker-roll-anim {
          animation: ticker-roll 30s linear infinite;
        }
      `}</style>

      <div
        className={`grid grid-cols-[auto_1fr] bg-surface-paper border border-line-sub border-t-0 rounded-b-rad overflow-hidden ${className}`}
      >
        {/* Flag marker — leftmost cell */}
        <div
          className={`flex items-center gap-2 px-4 py-2 font-display font-extrabold text-[11px] tracking-[0.18em] shrink-0 ${flagMarkerClass(highlights[0]?.severity ?? 'highlight')}`}
        >
          <span className="w-2 h-2 bg-current rounded-full shrink-0" style={{ animation: 'pulse 1.4s ease-in-out infinite' }} />
          {flagLabel(highlights[0]?.severity ?? 'highlight')}
        </div>

        {/* Ticker track — scrolling entries */}
        <div className="overflow-hidden relative flex items-center">
          <div className="ticker-roll-anim flex gap-8 whitespace-nowrap font-mono text-[11px] text-ink-mute py-2 px-4">
            {doubled.map((entry, i) => (
              <span key={`${entry.lap}-${i}`} className="inline-flex gap-2 items-center">
                <span className="text-sig-amber font-semibold">L{entry.lap}</span>
                <span className="w-[3px] h-[3px] bg-line-strong rounded-full inline-block" />
                <span>{entry.text}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
