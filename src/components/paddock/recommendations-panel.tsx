'use client'

import type { Recommendation } from '@/types/delegation'

interface RecommendationsPanelProps {
  recommendations: Recommendation[]
  onApply: (id: string) => void
  onDismiss: (id: string) => void
  className?: string
}

const ROLE_LABEL: Record<Recommendation['role'], string> = {
  'technical-director': 'Technical Director',
  'race-engineer': 'Race Engineer',
  'commercial-director': 'Commercial Director',
  'team-manager': 'Team Manager',
}

const ROLE_GLYPH: Record<Recommendation['role'], string> = {
  'technical-director': 'TD',
  'race-engineer': 'RE',
  'commercial-director': 'CD',
  'team-manager': 'TM',
}

export function RecommendationsPanel({
  recommendations,
  onApply,
  onDismiss,
  className = '',
}: RecommendationsPanelProps) {
  const active = recommendations.filter(r => r.status === 'active')

  return (
    <div className={`pd-rec ${className}`} role="feed" aria-label="Engineer recommendations">
      <div className="pd-panel-head">
        <div className="ph-title"><span className="ph-dot" />Engineer Recommendations</div>
        <div className="ph-sub">{active.length} ACTIVE</div>
      </div>

      <div className="pd-rec-body">
        {active.length === 0 ? (
          <div className="pd-feed-empty">
            <div className="pd-feed-empty-icon">◇</div>
            <div className="pd-feed-empty-t">ALL CLEAR</div>
            <div className="pd-feed-empty-s">Department heads have no open recommendations.</div>
          </div>
        ) : active.map(rec => (
          <div key={rec.id} className="pd-rec-item">
            <div className="pd-rec-glyph" aria-hidden>{ROLE_GLYPH[rec.role]}</div>
            <div className="pd-rec-content">
              <div className="pd-rec-role">{ROLE_LABEL[rec.role]}</div>
              <div className="pd-rec-text">{rec.description}</div>
              <div className="pd-rec-actions">
                {rec.applicable ? (
                  <>
                    <button type="button" className="pd-rec-btn primary" onClick={() => onApply(rec.id)}>
                      Apply
                    </button>
                    <button type="button" className="pd-rec-btn" onClick={() => onDismiss(rec.id)}>
                      Dismiss
                    </button>
                  </>
                ) : (
                  <>
                    <span className="pd-rec-info" title="Informational only — no direct action">
                      ◆ Informational
                    </span>
                    <button type="button" className="pd-rec-btn" onClick={() => onDismiss(rec.id)}>
                      Dismiss
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
