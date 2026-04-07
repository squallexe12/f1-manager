'use client'

import type { NarrativeEvent } from '@/types/narrative'
import { FeedItem } from './feed-item'

interface PaddockFeedProps {
  events: NarrativeEvent[]
  onResolve?: (eventId: string, optionId: string) => void
  className?: string
}

export function PaddockFeed({ events, onResolve, className = '' }: PaddockFeedProps) {
  const sorted = [...events].sort((a, b) => b.triggeredAtRound - a.triggeredAtRound)

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)]">
        Paddock Feed
      </h3>
      {sorted.length === 0 ? (
        <p className="text-xs text-[var(--text-dim)] italic">No events yet. Race on to generate paddock activity.</p>
      ) : (
        <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-1">
          {sorted.map((event) => (
            <FeedItem key={event.id} event={event} onResolve={onResolve} />
          ))}
        </div>
      )}
    </div>
  )
}
