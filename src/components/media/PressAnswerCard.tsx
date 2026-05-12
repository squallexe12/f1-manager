'use client'

import React from 'react'
import type { PressAnswer } from '@/types/media'

interface Props {
  answer: PressAnswer
  selected: boolean
  onSelect: () => void
  /** true after the press event has been submitted — locks all cards. */
  disabled?: boolean
}

export function PressAnswerCard({ answer, selected, onSelect, disabled }: Props) {
  const { tone, text, delta } = answer

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={[
        'press-answer',
        'press-glass',
        `tone-${tone}`,
        selected ? 'press-answer--selected' : '',
      ].filter(Boolean).join(' ')}
    >
      <span className="press-answer__tone">{tone.toUpperCase()}</span>
      <span className="press-answer__text">{text}</span>
      <span className="press-answer__deltas" aria-hidden="true">
        {renderDeltaHints(delta)}
      </span>
    </button>
  )
}

function renderDeltaHints(delta: PressAnswer['delta']): React.ReactNode {
  const hints: React.ReactNode[] = []

  if (delta.driverMood !== undefined && delta.driverMood !== 0) {
    const magnitude = Math.min(Math.ceil(Math.abs(delta.driverMood) / 2), 3)
    const arrow = delta.driverMood > 0 ? '▲'.repeat(magnitude) : '▼'.repeat(magnitude)
    hints.push(
      <span key="mood" className={delta.driverMood > 0 ? 'hint-pos' : 'hint-neg'}>
        {arrow} mood
      </span>,
    )
  }

  if (delta.sponsorKPI !== undefined && delta.sponsorKPI !== 0) {
    const arrow = delta.sponsorKPI > 0 ? '▲' : '▼'
    hints.push(
      <span key="kpi" className={delta.sponsorKPI > 0 ? 'hint-pos' : 'hint-neg'}>
        {arrow} KPI
      </span>,
    )
  }

  if (delta.prestige !== undefined && delta.prestige !== 0) {
    const arrow = delta.prestige > 0 ? '▲' : '▼'
    hints.push(
      <span key="prestige" className={delta.prestige > 0 ? 'hint-pos' : 'hint-neg'}>
        {arrow} prestige
      </span>,
    )
  }

  if (delta.rumorWeight) {
    const total = Object.values(delta.rumorWeight).reduce(
      (s, v) => s + (v ?? 0),
      0,
    )
    if (total > 0) {
      hints.push(
        <span key="rumor" className="hint-warn">
          {'⚠'.repeat(Math.min(total, 3))} rumor
        </span>,
      )
    }
  }

  if (delta.teammateMood !== undefined && delta.teammateMood !== 0) {
    const arrow = delta.teammateMood > 0 ? '▲' : '▼'
    hints.push(
      <span key="teammate" className={delta.teammateMood > 0 ? 'hint-pos' : 'hint-neg'}>
        {arrow} teammate
      </span>,
    )
  }

  if (hints.length === 0) return null

  return (
    <>
      {hints.map((h, i) => (
        <React.Fragment key={i}>
          {h}
          {i < hints.length - 1 ? <span className="hint-sep"> · </span> : null}
        </React.Fragment>
      ))}
    </>
  )
}

