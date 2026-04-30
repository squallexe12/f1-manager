// src/data/driver-radio-profiles.ts
import type { DriverRadioProfile } from '@/types/radio'

/**
 * Personality registry for all 22 drivers on the 2026 grid.
 *
 * Each driver carries a primary archetype and optionally a secondary that
 * blends in the picker (eligible templates are the union of both archetype
 * pools). Drivers may also override or add signature lines per category;
 * when a category has signatures and the catchphrase roll succeeds, the
 * picker selects from those instead of the archetype pool.
 *
 * Invariant: every Driver.id in `src/data/drivers.ts` MUST have an entry
 * here. `tests/data/driver-radio-profiles.test.ts` enforces this.
 */
export const DRIVER_RADIO_PROFILES: readonly DriverRadioProfile[] = [
  // McLaren
  {
    driverId: 'norris',
    archetypes: ['calm-pro'],
    signatureLines: {
      overtake_done: ['Yes! Lovely. Lovely.'],
      driver_frustration: ['Mate, what was that.'],
    },
    catchphraseChance: 0.3,
  },
  {
    driverId: 'piastri',
    archetypes: ['calm-pro'],
    signatureLines: {
      pit_confirm: ['Copy.'],
      overtake_done: ['Done.'],
    },
    catchphraseChance: 0.25,
  },
  // Red Bull
  {
    driverId: 'verstappen',
    archetypes: ['hot-headed', 'veteran'],
    signatureLines: {
      overtake_done: ['Simply lovely.', 'Yes! Yes! Get in!'],
      driver_frustration: ['I told you ten laps ago.', 'What a stupid call. Stupid.'],
      tire_complaint: ['These tyres are dead. Dead.'],
    },
    catchphraseChance: 0.35,
  },
  {
    driverId: 'hadjar',
    archetypes: ['rookie'],
    catchphraseChance: 0.15,
  },
  // Ferrari
  {
    driverId: 'leclerc',
    archetypes: ['emotional'],
    signatureLines: {
      driver_frustration: ['I am stupid. I am stupid.', 'No no no no.'],
      overtake_failed: ['What a mess. What a mess.'],
    },
    catchphraseChance: 0.35,
  },
  {
    driverId: 'hamilton',
    archetypes: ['spiritual', 'veteran'],
    signatureLines: {
      overtake_done: ['Get in there Lewis!', 'Still we rise.'],
      final_lap: ['Bring it home, mate. Bring it home.'],
    },
    catchphraseChance: 0.35,
  },
  // Mercedes
  {
    driverId: 'russell',
    archetypes: ['calm-pro'],
    signatureLines: {
      driver_frustration: ['What is going on?'],
    },
    catchphraseChance: 0.25,
  },
  {
    driverId: 'antonelli',
    archetypes: ['rookie'],
    catchphraseChance: 0.15,
  },
  // Aston Martin
  {
    driverId: 'alonso',
    archetypes: ['hot-headed', 'veteran'],
    signatureLines: {
      overtake_done: ['Magic. This is magic.'],
      driver_frustration: ['I am Alonso. I am ALONSO.', 'Unbelievable. Unbelievable.'],
    },
    catchphraseChance: 0.4,
  },
  {
    driverId: 'stroll',
    archetypes: ['veteran'],
    catchphraseChance: 0.15,
  },
  // Williams
  {
    driverId: 'albon',
    archetypes: ['calm-pro'],
    catchphraseChance: 0.2,
  },
  {
    driverId: 'sainz',
    archetypes: ['calm-pro', 'veteran'],
    signatureLines: {
      overtake_done: ['Vamos!'],
    },
    catchphraseChance: 0.25,
  },
  // Racing Bulls
  {
    driverId: 'lawson',
    archetypes: ['hot-headed'],
    catchphraseChance: 0.2,
  },
  {
    driverId: 'lindblad',
    archetypes: ['rookie'],
    catchphraseChance: 0.15,
  },
  // Alpine
  {
    driverId: 'gasly',
    archetypes: ['emotional'],
    signatureLines: {
      driver_frustration: ['I cannot believe it. I cannot believe it.'],
    },
    catchphraseChance: 0.3,
  },
  {
    driverId: 'colapinto',
    archetypes: ['rookie', 'hot-headed'],
    catchphraseChance: 0.2,
  },
  // Haas
  {
    driverId: 'ocon',
    archetypes: ['hot-headed'],
    catchphraseChance: 0.2,
  },
  {
    driverId: 'bearman',
    archetypes: ['rookie'],
    catchphraseChance: 0.15,
  },
  // Audi
  {
    driverId: 'hulkenberg',
    archetypes: ['veteran'],
    signatureLines: {
      driver_frustration: ['Same story. Same story every time.'],
    },
    catchphraseChance: 0.25,
  },
  {
    driverId: 'bortoleto',
    archetypes: ['rookie'],
    catchphraseChance: 0.15,
  },
  // Cadillac
  {
    driverId: 'bottas',
    archetypes: ['veteran', 'calm-pro'],
    signatureLines: {
      pit_confirm: ['Copy. To you, Toto.'],
    },
    catchphraseChance: 0.2,
  },
  {
    driverId: 'perez',
    archetypes: ['veteran'],
    catchphraseChance: 0.2,
  },
] as const
