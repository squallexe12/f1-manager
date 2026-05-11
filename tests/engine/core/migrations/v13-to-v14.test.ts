import { describe, expect, it } from 'vitest'
import { MIGRATIONS } from '@/engine/core/save-system'
import { initializeGame } from '@/engine/core/state-manager'

describe('schema migration v13 → v14 (media slice)', () => {
  it('adds an empty media slice when missing', () => {
    const v13Save = initializeGame('mclaren', 'rebuild', 42)
    // Simulate a v13 save by stripping the media slice
    const stripped = { ...v13Save } as Record<string, unknown>
    delete stripped.media

    const migrated = MIGRATIONS[13](stripped as never)

    expect(migrated.media).toEqual({ pendingPress: null, transcripts: [] })
  })

  it('does not overwrite existing media data', () => {
    const v13WithMedia = initializeGame('mclaren', 'rebuild', 42)
    const withTranscript = {
      ...v13WithMedia,
      media: {
        pendingPress: null,
        transcripts: [{ eventId: 'x', surface: 'post-race' as const, round: 1, season: 2026, speakerLabel: 'A', speakerDriverId: null, exchanges: [], aggregateDelta: {} }],
      },
    }

    const migrated = MIGRATIONS[13](withTranscript as never)

    expect(migrated.media.transcripts).toHaveLength(1)
  })
})
