'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useGameStore } from '@/stores/game-store'
import { useSaveGame } from '@/hooks/use-save-game'
import { AUTO_SAVE_SLOT } from '@/engine/core/save-system'
import { Button } from '@/components/ui/button'
import { LoadGameModal } from '@/components/menu/load-game-modal'

export default function Home() {
  const router = useRouter()
  const world = useGameStore((s) => s.world)
  const { loadGame, listSaves } = useSaveGame()
  const [hasAutoSave, setHasAutoSave] = useState(false)
  const [checking, setChecking] = useState(true)
  const [loadOpen, setLoadOpen] = useState(false)
  const closeLoad = useCallback(() => setLoadOpen(false), [])

  useEffect(() => {
    listSaves().then((saves) => {
      setHasAutoSave(saves.some((s) => s.slotId === AUTO_SAVE_SLOT))
      setChecking(false)
    })
  }, [listSaves])

  async function handleContinue() {
    await loadGame(AUTO_SAVE_SLOT)
    router.push('/paddock')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
      <div className="text-center max-w-md mx-auto px-6">
        {/* Branding */}
        <p className="text-[var(--accent-lime)] text-[10px] tracking-[6px] mb-4 font-mono uppercase">
          Mission Control
        </p>
        <h1 className="text-5xl font-heading font-bold mb-2 tracking-tight text-[var(--text-primary)]">
          F1 Kinetic Command
        </h1>
        <p className="text-sm text-[var(--text-muted)] mb-10">
          Command your constructor. Build your legacy.
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-3 items-center">
          <Button
            size="lg"
            onClick={() => router.push('/new-game')}
            className="w-56"
          >
            New Game
          </Button>

          {hasAutoSave && (
            <Button
              variant="secondary"
              size="lg"
              onClick={handleContinue}
              className="w-56"
            >
              Continue
            </Button>
          )}

          <Button
            variant="ghost"
            size="md"
            onClick={() => setLoadOpen(true)}
            className="w-56"
          >
            Load Game
          </Button>
        </div>

        {/* Version */}
        <p className="text-[10px] text-[var(--text-dim)] mt-12 font-mono">
          v0.1.0 — MVP
        </p>
      </div>

      <LoadGameModal open={loadOpen} onClose={closeLoad} />
    </main>
  )
}
