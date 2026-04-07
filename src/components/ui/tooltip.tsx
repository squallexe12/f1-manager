'use client'

import { useState, type ReactNode } from 'react'

interface TooltipProps {
  content: string
  children: ReactNode
  className?: string
}

export function Tooltip({ content, children, className = '' }: TooltipProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className="
            absolute bottom-full left-1/2 -translate-x-1/2 mb-2
            px-2.5 py-1.5 rounded-md
            bg-[var(--bg-secondary)] border border-[var(--border-hover)]
            text-xs text-[var(--text-secondary)]
            whitespace-nowrap z-50
            pointer-events-none
          "
        >
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 rotate-45 bg-[var(--bg-secondary)] border-r border-b border-[var(--border-hover)]" />
        </div>
      )}
    </div>
  )
}
