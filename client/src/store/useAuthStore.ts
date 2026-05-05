import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types'

// What we store after a successful login or register:
// - token: the JWT string the server gave us (we'll send this with every request)
// - user:  the logged-in user's basic info (id, name, email, avatarUrl)

interface AuthStore {
  token: string | null
  user: User | null
  // Call this after a successful /api/auth/login or /api/auth/register response
  setAuth: (token: string, user: User) => void
  // Call this when the user clicks "Log out"
  clearAuth: () => void
}

export const useAuthStore = create<AuthStore>()(
  // persist saves the store to localStorage so the user stays logged in
  // after a page refresh — without this, every refresh would log them out
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      clearAuth: () => set({ token: null, user: null }),
    }),
    { name: 'fairshare-auth' }, // the localStorage key
  ),
)
