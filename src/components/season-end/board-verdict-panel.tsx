'use client'

import type { BoardVerdict } from '@/engine/board/board-objectives'

type VerdictWithRival = BoardVerdict & { rivalTeamId: string }

const COPY = {
  retain: { title: 'The board retains you', tone: 'secure', blurb: 'Mandate met. Your seat is safe for next season.' },
  warning: { title: 'Final warning', tone: 'pressure', blurb: 'You fell short. One more miss and the board will act.' },
  sack: { title: 'You have been sacked', tone: 'brink', blurb: 'A second season below expectations. The board has terminated your tenure.' },
} as const

export function BoardVerdictPanel({
  verdict, onNewCareer,
}: { verdict: VerdictWithRival; onNewCareer: () => void }) {
  const c = COPY[verdict.verdict]
  return (
    <section className={`se-verdict se-verdict--${c.tone}`} aria-label="Board verdict">
      <h2 className="se-verdict-title">{c.title}</h2>
      <p className="se-verdict-blurb">{c.blurb}</p>
      <ul className="se-verdict-objectives">
        {verdict.objectives.map((o) => (
          <li key={o.kind} className={o.met ? 'is-met' : 'is-missed'}>
            {o.met ? '✓' : '✕'} {o.label}
          </li>
        ))}
      </ul>
      {verdict.verdict === 'sack' && (
        <button type="button" className="se-verdict-cta" onClick={onNewCareer}>
          Start New Career
        </button>
      )}
    </section>
  )
}
