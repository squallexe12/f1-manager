'use client'

interface FpSessionSelectorProps {
  /** Total FP sub-sessions this weekend: 3 (standard) or 1 (sprint). */
  total: number
  /** FP index currently being planned / revealed (0-based). */
  activeIndex: number
  /** Number of FP sessions already committed (practiceResults.length). */
  completedCount: number
  className?: string
}

/**
 * FP1 / FP2 / FP3 progression pills (plan §M5). Purely presentational — the
 * active sub-session is DERIVED from `practiceResults.length`, never selected by
 * the user, so completed pills are static (no re-run). Sprint weekends pass
 * `total = 1` and render FP1 alone.
 */
export function FpSessionSelector({ total, activeIndex, completedCount, className = '' }: FpSessionSelectorProps) {
  return (
    <ol
      className={`flex items-center gap-2 ${className}`}
      aria-label="Free practice sessions"
    >
      {Array.from({ length: total }).map((_, i) => {
        const isDone = i < completedCount
        const isActive = i === activeIndex
        const stateClass = isDone
          ? 'border-sig-green/50 bg-sig-green/10 text-sig-green'
          : isActive
            ? 'border-sig-red bg-sig-red/10 text-sig-red'
            : 'border-line-sub bg-surface-raised text-ink-dim'
        return (
          <li
            key={i}
            aria-current={isActive ? 'step' : undefined}
            className={`flex items-center gap-2 rounded-rad border px-3 py-1.5 ${stateClass}`}
          >
            <span className="font-display font-bold text-[13px] tracking-[0.04em]">FP{i + 1}</span>
            {isDone ? (
              <span className="font-mono text-[8px] font-bold uppercase tracking-[0.16em]">
                ✓ Done
              </span>
            ) : isActive ? (
              <span className="font-mono text-[8px] font-bold uppercase tracking-[0.16em]">◉ Live</span>
            ) : (
              <span className="font-mono text-[8px] uppercase tracking-[0.16em] opacity-70">Pending</span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
