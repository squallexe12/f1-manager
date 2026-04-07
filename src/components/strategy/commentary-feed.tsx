'use client'

import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { CommentaryEntry } from '@/types/race'

interface CommentaryFeedProps {
  entries: CommentaryEntry[]
  className?: string
}

const SEVERITY_BORDER: Record<string, string> = {
  critical: 'var(--accent-red)',
  highlight: 'var(--accent-lime)',
  radio: 'var(--accent-purple)',
  info: 'var(--accent-cyan)',
  neutral: 'var(--text-dim)',
}

export function CommentaryFeed({ entries, className = '' }: CommentaryFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Scroll only within the container, not the page
    const el = containerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [entries.length])

  return (
    <div
      ref={containerRef}
      className={`flex flex-col gap-1 max-h-[300px] overflow-y-auto pr-1 ${className}`}
      role="log"
      aria-label="Race commentary feed"
      aria-live="polite"
    >
      <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)] sticky top-0 bg-[var(--bg-primary)] py-1">
        Commentary
      </h3>
      {entries.length === 0 ? (
        <p className="text-xs text-[var(--text-dim)] italic">Waiting for race to begin...</p>
      ) : (
        entries.map((entry, i) => (
          <motion.div
            key={`${entry.lap}-${i}`}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
            className="flex gap-2 border-l-2 pl-2 py-1"
            style={{ borderLeftColor: SEVERITY_BORDER[entry.severity] ?? 'var(--text-dim)' }}
          >
            <span className="text-[10px] font-mono text-[var(--text-dim)] shrink-0 w-8" aria-label={`Lap ${entry.lap}`}>
              L{entry.lap}
            </span>
            <span className="text-xs text-[var(--text-secondary)]">{entry.text}</span>
          </motion.div>
        ))
      )}
    </div>
  )
}
