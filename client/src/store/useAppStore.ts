import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppStore {
  // The ID of the user who is "logged in" — used before real auth is added
  currentUserId: string | null
  setCurrentUserId: (id: string | null) => void
}

// persist saves the store to localStorage so the chosen user survives a page refresh
export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      currentUserId: null,
      setCurrentUserId: (id) => set({ currentUserId: id }),
    }),
    { name: 'fairshare-app' },
  ),
)
