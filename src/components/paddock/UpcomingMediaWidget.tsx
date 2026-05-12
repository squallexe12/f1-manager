'use client'

import { useState } from 'react'
import Image from 'next/image'
import { usePressConference } from '@/hooks/use-press-conference'
import { useGameStore } from '@/stores/game-store'
import { useShallow } from 'zustand/react/shallow'
import { selectLastTranscript } from '@/stores/selectors/media'
import { PressRoomModal } from '@/components/media/PressRoomModal'

export function UpcomingMediaWidget() {
  const press = usePressConference()
  const lastTranscript = useGameStore(useShallow(selectLastTranscript))
  const [isModalOpen, setIsModalOpen] = useState(false)

  if (press.hasPending && press.pendingPress) {
    const surfaceClass =
      press.pendingPress.surface === 'thursday-fia'
        ? 'media-widget__surface--cyan'
        : 'media-widget__surface--lime'
    const surfaceLabel =
      press.pendingPress.surface === 'thursday-fia' ? 'Thursday Press' : 'Post-Race Interview'

    return (
      <>
        <div className="media-widget media-widget--pending press-glass">
          <div className={`media-widget__surface ${surfaceClass}`}>{surfaceLabel}</div>
          {press.speakerDriverPortrait && (
            <Image
              src={press.speakerDriverPortrait}
              alt={press.speakerLabel}
              width={56}
              height={72}
              className="media-widget__portrait"
            />
          )}
          <div className="media-widget__speaker">{press.speakerLabel}</div>
          <div className="media-widget__outlets">{press.questions.length} outlets attending</div>
          <button
            type="button"
            className="media-widget__cta"
            onClick={() => setIsModalOpen(true)}
          >
            Enter Press Room
          </button>
        </div>
        <PressRoomModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </>
    )
  }

  if (lastTranscript) {
    const lastExchange = lastTranscript.exchanges[0]
    return (
      <div className="media-widget media-widget--recap press-glass">
        <div className="media-widget__head">Last Press</div>
        <div className="media-widget__speaker">{lastTranscript.speakerLabel}</div>
        {lastExchange ? (
          <p className="media-widget__excerpt">&ldquo;{lastExchange.answer}&rdquo;</p>
        ) : (
          <p className="media-widget__excerpt media-widget__excerpt--skipped">
            Press conference skipped.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="media-widget media-widget--empty press-glass">
      <div className="media-widget__head">Media</div>
      <p className="media-widget__placeholder">No press conferences yet this season.</p>
    </div>
  )
}
