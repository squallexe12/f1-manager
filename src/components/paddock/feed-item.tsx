import type { NarrativeEvent } from '@/types/narrative'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface FeedItemProps {
  event: NarrativeEvent
  onResolve?: (eventId: string, optionId: string) => void
  className?: string
}

const SEVERITY_COLORS: Record<string, string> = {
  breaking: 'var(--accent-red)',
  decision: 'var(--accent-amber)',
  technical: 'var(--accent-cyan)',
  rumor: 'var(--accent-purple)',
  news: 'var(--text-dim)',
}

const SEVERITY_BADGE: Record<string, 'red' | 'amber' | 'cyan' | 'purple' | 'neutral'> = {
  breaking: 'red',
  decision: 'amber',
  technical: 'cyan',
  rumor: 'purple',
  news: 'neutral',
}

export function FeedItem({ event, onResolve, className = '' }: FeedItemProps) {
  const borderColor = SEVERITY_COLORS[event.severity] ?? 'var(--text-dim)'

  return (
    <div
      className={`border-l-2 pl-3 py-2 ${className}`}
      style={{ borderLeftColor: borderColor }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Badge variant={SEVERITY_BADGE[event.severity] ?? 'neutral'}>
          {event.severity}
        </Badge>
        <span className="text-[10px] font-mono text-[var(--text-dim)]">
          R{event.triggeredAtRound}
        </span>
      </div>

      <h4 className="text-sm font-heading font-semibold text-[var(--text-primary)] mb-0.5">
        {event.headline}
      </h4>
      <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-2">
        {event.body}
      </p>

      {/* Action buttons */}
      {event.options && !event.resolved && onResolve && (
        <div className="flex flex-wrap gap-2">
          {event.options.map((option) => (
            <Button
              key={option.id}
              variant="secondary"
              size="sm"
              onClick={() => onResolve(event.id, option.id)}
            >
              {option.text}
            </Button>
          ))}
        </div>
      )}

      {event.resolved && (
        <span className="text-[10px] text-[var(--text-dim)] italic">Resolved</span>
      )}
    </div>
  )
}
