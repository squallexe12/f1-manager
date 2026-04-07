import { create } from 'zustand'

export type PageId = 'paddock' | 'factory' | 'drivers' | 'strategy' | 'finance' | 'calendar' | 'regulations'

export interface Notification {
  id: string
  message: string
  severity: 'info' | 'success' | 'warning' | 'error'
  timestamp: number
}

interface UIStore {
  activePage: PageId
  selectedDriverId: string | null
  selectedTeamId: string | null
  activeModal: string | null
  notifications: Notification[]

  setActivePage: (page: PageId) => void
  selectDriver: (driverId: string | null) => void
  selectTeam: (teamId: string | null) => void
  openModal: (modalId: string) => void
  closeModal: () => void
  addNotification: (message: string, severity: Notification['severity']) => void
  dismissNotification: (id: string) => void
}

export const useUIStore = create<UIStore>((set) => ({
  activePage: 'paddock',
  selectedDriverId: null,
  selectedTeamId: null,
  activeModal: null,
  notifications: [],

  setActivePage: (page) => set({ activePage: page }),
  selectDriver: (driverId) => set({ selectedDriverId: driverId }),
  selectTeam: (teamId) => set({ selectedTeamId: teamId }),
  openModal: (modalId) => set({ activeModal: modalId }),
  closeModal: () => set({ activeModal: null }),

  addNotification: (message, severity) =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        { id: `notif-${Date.now()}`, message, severity, timestamp: Date.now() },
      ],
    })),

  dismissNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
}))
