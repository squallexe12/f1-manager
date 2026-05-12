'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { REG_TERMS, type RegTerm } from '@/data/regulations/2026-rules'

interface RegInfoBubbleProps {
  term: RegTerm
  children: React.ReactNode
}

const warnedTerms = new Set<string>()

export function RegInfoBubble({ term, children }: RegInfoBubbleProps) {
  const entry = REG_TERMS[term]
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onScroll = () => setOpen(false)
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('mousedown', onDown)
    }
  }, [open])

  if (!entry) {
    if (!warnedTerms.has(term)) {
      console.warn(`[RegInfoBubble] unknown term: ${term}`)
      warnedTerms.add(term)
    }
    return <>{children}</>
  }

  const handleKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOpen((v) => !v)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <span className="reg-bubble" ref={ref}>
      <button
        type="button"
        className="reg-bubble-underline"
        aria-describedby={open ? `reg-bubble-${term}` : undefined}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleKey}
      >
        {children}
      </button>
      {open && (
        <span id={`reg-bubble-${term}`} role="tooltip" className="reg-bubble-tooltip">
          <strong className="reg-bubble-label">{entry.label}</strong>
          <span className="reg-bubble-explainer">{entry.explainer}</span>
          {entry.seeAlso && (
            <a className="reg-bubble-readmore" href={`#reg-${entry.seeAlso}`}>
              Read more →
            </a>
          )}
        </span>
      )}
    </span>
  )
}
