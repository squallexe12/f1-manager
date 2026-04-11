'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useGameStore } from '@/stores/game-store'
import { useShallow } from 'zustand/react/shallow'
import type { FullGameState } from '@/engine/core/state-manager'

/**
 * Hook that ensures a game is loaded before rendering a page.
 * Returns the world state, or null if redirecting to home.
 * Redirect happens in useEffect (not during render) to avoid SSR issues.
 *
 * For re-render optimization, prefer useGameSlice() in components that
 * only need specific parts of the world state.
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

/**
 * Select specific slices from the game world with shallow equality.
 * Components only re-render when their selected slices actually change.
 *
 * Usage:
 *   const { teams, gameState } = useGameSlice(w => ({
 *     teams: w.teams,
 *     gameState: w.gameState,
 *   }))
 */
export function useGameSlice<T>(selector: (world: FullGameState) => T): T | null {
  return useGameStore(
    useShallow((s) => (s.world ? selector(s.world) : null))
  )
}
