'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSaveGame } from '@/hooks/use-save-game'
import { useGameStore } from '@/stores/game-store'
import { AUTO_SAVE_SLOT, SCHEMA_VERSION, type SlotInfo } from '@/engine/core/save-system'
import { Badge } from '@/components/ui/badge'

interface LoadGameModalProps {
  open: boolean
  onClose: () => void
}

/** Human-friendly relative time, falling back to an absolute date past a week. */
function formatRelative(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 0) return 'Just now'
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'Just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function LoadGameModal({ open, onClose }: LoadGameModalProps) {
  const router = useRouter()
  const { listSaves, loadGame, deleteSave, status } = useSaveGame()
  const [saves, setSaves] = useState<SlotInfo[] | null>(null)
  // Per-slot in-flight marker — useSaveGame().status is a global busy flag, not per-row.
  const [busySlot, setBusySlot] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)

  const refresh = useCallback(async () => {
    const list = await listSaves()
    list.sort((a, b) => b.timestamp - a.timestamp)
    setSaves(list)
  }, [listSaves])

  // Reset transient state and (re)fetch the slot list each time the modal opens.
  // State is set inside the async closure, not the effect body, to avoid the
  // cascading-render lint and a post-delete "Loading" flicker (refresh alone
  // never nulls the list).
  useEffect(() => {
    if (!open) return
    void (async () => {
      setConfirmDelete(null)
      setSaves(null)
      await refresh()
    })()
  }, [open, refresh])

  // Escape to close; move focus into the dialog on open and restore it to the
  // triggering element on close so keyboard users don't lose their place.
  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previouslyFocused?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  async function handleLoad(slot: SlotInfo) {
    if (slot.schemaVersion > SCHEMA_VERSION) return
    setBusySlot(slot.slotId)
    const before = useGameStore.getState().world
    await loadGame(slot.slotId)
    const after = useGameStore.getState().world
    setBusySlot(null)
    // A successful load swaps in a fresh world reference; navigate only then.
    if (after && after !== before) {
      onClose()
      router.push('/paddock')
    }
  }

  async function handleDelete(slotId: string) {
    setBusySlot(slotId)
    await deleteSave(slotId)
    setBusySlot(null)
    setConfirmDelete(null)
    await refresh()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="load-game-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-lg max-h-[80vh] flex flex-col rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] shadow-[0_24px_64px_rgba(0,0,0,0.6)] outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-default)]">
          <h2
            id="load-game-title"
            className="text-sm font-heading font-bold uppercase tracking-wider text-[var(--text-primary)]"
          >
            Load Game
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors text-lg leading-none px-1"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-4 flex flex-col gap-2">
          {saves === null ? (
            <p className="text-xs text-[var(--text-dim)] italic py-6 text-center">Loading saves…</p>
          ) : saves.length === 0 ? (
            <p className="text-xs text-[var(--text-dim)] italic py-6 text-center">
              No saved games yet — start a New Game.
            </p>
          ) : (
            saves.map((slot) => {
              const isAuto = slot.slotId === AUTO_SAVE_SLOT
              const tooNew = slot.schemaVersion > SCHEMA_VERSION
              const busy = busySlot === slot.slotId
              return (
                <div
                  key={slot.slotId}
                  className="flex items-center gap-3 rounded-lg border border-[var(--border-default)] bg-white/[0.02] px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-heading font-semibold text-[var(--text-primary)] truncate">
                        {slot.name || slot.slotId}
                      </span>
                      <Badge variant={isAuto ? 'cyan' : 'neutral'}>{isAuto ? 'Auto' : 'Manual'}</Badge>
                    </div>
                    <div className="text-[10px] font-mono text-[var(--text-dim)] mt-0.5">
                      {formatRelative(slot.timestamp)}
                      {tooNew && (
                        <span className="text-[var(--accent-amber)] ml-2">· newer build — can’t load</span>
                      )}
                    </div>
                  </div>

                  {confirmDelete === slot.slotId ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDelete(slot.slotId)}
                        disabled={busy}
                        className="text-[10px] font-heading uppercase tracking-wider px-2 py-1 rounded bg-[var(--accent-red)]/15 text-[var(--accent-red)] hover:bg-[var(--accent-red)]/25 transition-colors disabled:opacity-50"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(null)}
                        className="text-[10px] font-heading uppercase tracking-wider px-2 py-1 rounded text-[var(--text-dim)] hover:text-[var(--text-secondary)] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleLoad(slot)}
                        disabled={busy || tooNew}
                        className="text-[10px] font-heading font-semibold uppercase tracking-wider px-3 py-1.5 rounded bg-[var(--accent-lime)]/15 text-[var(--accent-lime)] hover:bg-[var(--accent-lime)]/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {busy ? '…' : 'Load'}
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${slot.name || slot.slotId}`}
                        onClick={() => setConfirmDelete(slot.slotId)}
                        disabled={busy}
                        className="text-[10px] font-heading uppercase tracking-wider px-2 py-1.5 rounded text-[var(--text-dim)] hover:text-[var(--accent-red)] transition-colors disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}

          {status.lastError && (
            <p className="text-[10px] text-[var(--accent-red)] font-mono mt-1">
              {status.lastError}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
