'use client'

interface Props {
  total: number
  answered: number
  /** 0-indexed index of the currently active question. */
  active: number
}

export function PressProgressDots({ total, answered, active }: Props) {
  return (
    <div className="press-dots" role="group" aria-label={`Question ${active + 1} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={[
            'press-dot',
            i < answered ? 'press-dot--answered' : '',
            i === active ? 'press-dot--active' : '',
          ].filter(Boolean).join(' ')}
          aria-current={i === active ? 'step' : undefined}
        />
      ))}
    </div>
  )
}
