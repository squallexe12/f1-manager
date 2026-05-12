'use client'

import type { ResolvedPressQuestion } from '@/types/media'
import { PressAnswerCard } from './PressAnswerCard'

interface Props {
  question: ResolvedPressQuestion
  selectedAnswerId: string | null
  onSelectAnswer: (answerId: string) => void
  onSkip: () => void
  disabled?: boolean
}

export function PressQuestionPanel({
  question,
  selectedAnswerId,
  onSelectAnswer,
  onSkip,
  disabled,
}: Props) {
  return (
    <section className="press-panel press-glass" aria-live="polite">
      <header className="press-panel__head">
        <span className="press-panel__outlet">{question.outlet}</span>
        <span className="press-panel__journalist">{question.journalist}</span>
      </header>
      <p className="press-panel__question">{question.text}</p>
      <div className="press-panel__answers">
        {question.answers.map(answer => (
          <PressAnswerCard
            key={answer.id}
            answer={answer}
            selected={selectedAnswerId === answer.id}
            onSelect={() => onSelectAnswer(answer.id)}
            disabled={disabled}
          />
        ))}
      </div>
      <button
        type="button"
        className="press-panel__skip"
        onClick={onSkip}
        disabled={disabled}
        title="Skip press: −1 prestige, −3 driver mood"
      >
        Skip Press
      </button>
    </section>
  )
}
