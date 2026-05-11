'use client'

import type { PressSurface } from '@/types/media'

interface Props {
  /** Full name for driver or "Team Principal". */
  speakerLabel: string
  /** Portrait URL from Driver.portraitUrl, or null when TP or no portrait set. */
  speakerDriverPortrait: string | null
  speakerRole: 'driver' | 'team-principal'
  teamName: string
  surface: PressSurface
  /** 0-100 motivation snapshot. Null when the TP is the speaker. */
  driverMotivation: number | null
}

export function PressSpeakerCard({
  speakerLabel,
  speakerDriverPortrait,
  speakerRole,
  teamName,
  surface,
  driverMotivation,
}: Props) {
  const surfaceLabel = surface === 'thursday-fia' ? 'Thursday Press' : 'Post-Race'
  const surfaceColorClass = surface === 'thursday-fia' ? 'tone-cyan' : 'tone-lime'

  return (
    <aside className="press-speaker press-glass">
      <div className={`press-speaker__surface ${surfaceColorClass}`}>{surfaceLabel}</div>

      {speakerDriverPortrait ? (
        <img
          src={speakerDriverPortrait}
          alt={speakerLabel}
          className="press-speaker__portrait"
        />
      ) : (
        <div
          className="press-speaker__portrait press-speaker__portrait--tp"
          aria-label={speakerRole === 'team-principal' ? 'Team Principal' : speakerLabel}
        >
          TP
        </div>
      )}

      <h2 className="press-speaker__name">{speakerLabel}</h2>
      <div className="press-speaker__role">
        {speakerRole === 'driver' ? 'Driver' : 'Team Principal'}
      </div>
      <div className="press-speaker__team">{teamName}</div>

      {driverMotivation !== null && (
        <div
          className="press-speaker__mood"
          aria-label={`Motivation ${driverMotivation}`}
        >
          <span className="press-speaker__mood-label">MOTIVATION</span>
          <div className="press-speaker__mood-bar">
            <div
              className="press-speaker__mood-fill"
              style={{ width: `${driverMotivation}%` }}
            />
          </div>
        </div>
      )}
    </aside>
  )
}
