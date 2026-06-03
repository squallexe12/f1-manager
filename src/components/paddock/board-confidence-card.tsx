'use client'

import type { BoardExpectations } from '@/types/board'

// Band thresholds match engine constants: BAND_SECURE = 60, BAND_BRINK = 30
const BAND_LABEL = {
  secure: 'SECURE',
  pressure: 'UNDER PRESSURE',
  brink: 'ON THE BRINK',
} as const

type Band = keyof typeof BAND_LABEL

function getBand(confidence: number): Band {
  if (confidence > 60) return 'secure'
  if (confidence < 30) return 'brink'
  return 'pressure'
}

export function BoardConfidenceCard({ board }: { board: BoardExpectations }) {
  const b = getBand(board.confidence)
  const hist = board.confidenceHistory
  const prev = hist.length >= 2 ? hist[hist.length - 2] : board.confidence
  const trend = board.confidence > prev ? '▲' : board.confidence < prev ? '▼' : '—'
  const trendLabel = trend === '▲' ? 'trending up' : trend === '▼' ? 'trending down' : 'stable'

  return (
    <section className="pd-board-card" aria-label="Board confidence">
      <div className="pd-section-title">
        <span className="dot" />BOARD
      </div>
      <div className="pd-board-meter">
        <span className="pd-board-value">{board.confidence}</span>
        <span className={`pd-board-pill pd-board-pill--${b}`}>{BAND_LABEL[b]}</span>
        <span className="pd-board-trend" aria-label={`Board confidence ${trendLabel}`}>{trend}</span>
      </div>
      <div className="pd-board-bar">
        <div className="pd-board-bar-fill" style={{ width: `${board.confidence}%` }} />
      </div>
      <ul className="pd-board-objectives">
        {board.objectives.map((o, i) => (
          <li key={i} className={o.met ? 'is-met' : ''}>
            <span className="pd-board-obj-label">{o.label}</span>
            <span className="pd-board-obj-value">
              {o.kind === 'beatRival' ? (o.met ? '✓' : '—') : `${o.current}/${o.target}`}
            </span>
            {/* color alone signals met/unmet visually; spell it out for screen readers */}
            <span className="sr-only">{o.met ? 'met' : 'not met'}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
