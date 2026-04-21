'use client'

import { useMemo, useState } from 'react'
import type { NarrativeEvent, EventSeverity } from '@/types/narrative'
import type { CSSProperties } from 'react'

interface PaddockFeedProps {
  events: NarrativeEvent[]
  currentRound: number
  onResolve?: (eventId: string, optionId: string) => void
  className?: string
}

type FilterKey = 'all' | EventSeverity

const FILTERS: { k: FilterKey; l: string }[] = [
  { k: 'all', l: 'All' },
  { k: 'breaking', l: 'Breaking' },
  { k: 'decision', l: 'Decisions' },
  { k: 'technical', l: 'Technical' },
  { k: 'rumor', l: 'Rumors' },
  { k: 'news', l: 'News' },
]

const SEV_COLORS: Record<EventSeverity, string> = {
  breaking: 'var(--sig-red)',
  decision: 'var(--sig-amber)',
  technical: 'var(--sig-cyan)',
  rumor: 'var(--sig-purple)',
  news: 'var(--ink-dim)',
}

export function PaddockFeed({ events, currentRound, onResolve, className = '' }: PaddockFeedProps) {
  const [filter, setFilter] = useState<FilterKey>('all')

  const items = useMemo(() => {
    const sorted = [...events].sort((a, b) => b.triggeredAtRound - a.triggeredAtRound)
    return filter === 'all' ? sorted : sorted.filter(e => e.severity === filter)
  }, [events, filter])

  return (
    <div className={`pd-feed ${className}`} role="feed" aria-label="Paddock news feed">
      <div className="pd-panel-head">
        <div className="ph-title"><span className="ph-dot" />Paddock Feed</div>
        <div className="ph-sub">LIVE · R{String(currentRound).padStart(2, '0')}</div>
      </div>

      <div className="pd-feed-filters">
        {FILTERS.map(f => (
          <button
            key={f.k}
            type="button"
            className={`pd-filter-btn ${filter === f.k ? 'active' : ''}`}
            onClick={() => setFilter(f.k)}
          >
            {f.l}
          </button>
        ))}
        <div className="pd-filter-count">{items.length} ITEMS</div>
      </div>

      <div className="pd-feed-list">
        {items.length === 0 ? (
          <div className="pd-feed-empty">
            <div className="pd-feed-empty-icon">◇</div>
            <div className="pd-feed-empty-t">NO EVENTS IN THIS FILTER</div>
            <div className="pd-feed-empty-s">Scheduled briefings continue in the side panel</div>
          </div>
        ) : items.map(event => (
          <div
            key={event.id}
            className="pd-feed-item"
            style={{ '--sev-color': SEV_COLORS[event.severity] } as CSSProperties}
          >
            <div className="pd-feed-round">
              R{String(event.triggeredAtRound).padStart(2, '0')}
              <span className="sub">ROUND</span>
            </div>
            <div className="pd-feed-body">
              <div className="pd-feed-meta">
                <span className={`pd-sev ${event.severity}`}>{event.severity}</span>
              </div>
              <div className="pd-feed-head">{event.headline}</div>
              <div className="pd-feed-text">{event.body}</div>
              {event.options && !event.resolved && onResolve && (
                <div className="pd-feed-actions">
                  {event.options.map((o, i) => (
                    <button
                      key={o.id}
                      type="button"
                      className={`pd-rec-btn ${i === 0 ? 'primary' : ''}`}
                      onClick={() => onResolve(event.id, o.id)}
                    >
                      {o.text}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="pd-feed-right">
              <span className={`status-pill ${event.resolved ? 'resolved' : 'pending'}`}>
                {event.resolved ? '✓ RESOLVED' : '◉ PENDING'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
