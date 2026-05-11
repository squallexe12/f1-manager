'use client'

import Link from 'next/link'
import { useGameStore } from '@/stores/game-store'
import { useShallow } from 'zustand/react/shallow'
import { selectPendingPress } from '@/stores/selectors/media'

export function PressBadge() {
  const pending = useGameStore(useShallow(selectPendingPress))
  if (!pending) return null

  return (
    <Link href="/paddock" className="press-badge" aria-label="Press conference pending">
      <span className="press-badge__dot" aria-hidden="true">●</span>
      <span className="press-badge__label">Press</span>
      <span className="press-badge__count">1</span>
    </Link>
  )
}
