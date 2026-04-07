import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SimSpeed } from '@/types/race'

interface SettingsStore {
  simSpeed: SimSpeed
  highContrast: boolean
  reducedMotion: boolean
  soundEnabled: boolean

  setSimSpeed: (speed: SimSpeed) => void
  toggleHighContrast: () => void
  toggleReducedMotion: () => void
  toggleSound: () => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      simSpeed: 1,
      highContrast: false,
      reducedMotion: false,
      soundEnabled: true,

      setSimSpeed: (speed) => set({ simSpeed: speed }),
      toggleHighContrast: () => set((s) => ({ highContrast: !s.highContrast })),
      toggleReducedMotion: () => set((s) => ({ reducedMotion: !s.reducedMotion })),
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
    }),
    { name: 'f1-mc-settings' },
  ),
)
