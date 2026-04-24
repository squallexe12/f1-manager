'use client'

import type { CSSProperties } from 'react'
import type { RndUpgrade } from '@/types/team'

interface TechNodeProps {
  upgrade: RndUpgrade
  onStart?: (id: string) => void
  onPause?: (id: string) => void
  /** When true, node is the Technical Director's current active recommendation */
  recommended?: boolean
  /** Branch accent color (used for left rail override on the TD pick only) */
  branchColor?: string
}

export function TechNode({ upgrade, onStart, onPause, recommended = false, branchColor }: TechNodeProps) {
  const { status, name, description, progress, cost, developmentRaces, performanceDelta } = upgrade
  const isComplete = status === 'complete'
  const isInProgress = status === 'in-progress'
  const showRecommended = recommended && status === 'available'

  const etaRaces = isInProgress ? Math.ceil(((100 - progress) / 100) * developmentRaces) : 0
  const costM = (cost / 1_000_000).toFixed(1)
  const deltas = Object.entries(performanceDelta).filter(([, v]) => v !== undefined && v !== 0) as [string, number][]

  const statusLabel = status.replace('-', ' ')

  return (
    <div
      className={`tn ${status}${showRecommended ? ' td-pick' : ''}`}
      style={branchColor ? ({ ['--branch-color' as string]: branchColor } as CSSProperties) : undefined}
    >
      <div className="tn-top">
        <div className="tn-name">
          {isComplete && <span className="check">✓</span>}
          {name}
        </div>
        <div className="tn-tags">
          <span className={`tn-status ${status}`}>{statusLabel}</span>
          {showRecommended && <span className="tn-td">TD PICK</span>}
        </div>
      </div>

      <div className="tn-desc">{description}</div>

      {deltas.length > 0 && (
        <div className="tn-deltas">
          {deltas.map(([key, v]) => (
            <span key={key} className={`tn-delta ${v > 0 ? 'pos' : 'neg'}`}>
              {key.replace(/([A-Z])/g, ' $1').trim().toUpperCase()}: {v > 0 ? '+' : ''}
              {v}
            </span>
          ))}
        </div>
      )}

      {(isInProgress || isComplete) && (
        <div className="tn-prog-wrap">
          <div className="tn-prog-label">
            <span>PROGRESS · {Math.round(progress)}%</span>
            {isInProgress && <span className="eta">ETA {etaRaces} RACES</span>}
            {isComplete && <span className="deployed">DEPLOYED</span>}
          </div>
          <div className="tn-prog-track">
            <div
              className={`fill${isComplete ? ' complete' : ''}`}
              style={{ transform: `scaleX(${progress / 100})` }}
            />
          </div>
        </div>
      )}

      <div className="tn-foot">
        <div className="tn-cost">
          <span>
            <span className="c-val">${costM}M</span>
          </span>
          <span className="c-sep">·</span>
          <span>
            <span className="c-val">{developmentRaces}</span> RACES
          </span>
        </div>
        {status === 'available' && onStart && (
          <button type="button" className="tn-btn start" onClick={() => onStart(upgrade.id)}>
            START →
          </button>
        )}
        {isInProgress && onPause && (
          <button type="button" className="tn-btn pause" onClick={() => onPause(upgrade.id)}>
            PAUSE
          </button>
        )}
        {status === 'queued' && <button type="button" className="tn-btn ghost">QUEUED</button>}
        {status === 'locked' && <button type="button" className="tn-btn ghost">LOCKED</button>}
        {isComplete && <button type="button" className="tn-btn ghost">DEPLOYED</button>}
      </div>
    </div>
  )
}
