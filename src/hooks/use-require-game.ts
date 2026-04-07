'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useGameStore } from '@/stores/game-store'
import type { FullGameState } from '@/engine/core/state-manager'

/**
 * Hook that ensures a game is loaded before rendering a page.
 * Returns the world state, or null if redirecting to home.
 * Redirect happens in useEffect (not during render) to avoid SSR issues.
 */
export function useRequireGame(): FullGameState | null {
  const router = useRouter()
  const world = useGameStore((s) => s.world)

  useEffect(() => {
    if (!world) {
      router.replace('/')
    }
  }, [world, router])

  return world
}
