import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '@/types'

interface UserState {
  user: User | null
  token: string | null
  login: (nickname: string) => Promise<void>
  logout: () => void
  fetchProfile: () => Promise<void>
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,

      login: async (nickname: string) => {
        try {
          const res = await fetch('/api/auth/guest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nickname }),
          })
          
          if (!res.ok) {
            const err = await res.json()
            throw new Error(err.error || '登录失败')
          }

          const data = await res.json()
          set({ user: data.user, token: data.token })
        } catch (error) {
          console.error('Login error:', error)
          throw error
        }
      },

      logout: () => {
        set({ user: null, token: null })
      },

      fetchProfile: async () => {
        const { token } = get()
        if (!token) return

        try {
          const res = await fetch('/api/user/profile', {
            headers: { Authorization: `Bearer ${token}` },
          })
          
          if (res.ok) {
            const data = await res.json()
            set({ user: data.user })
          } else {
            // Token expired or invalid
            set({ user: null, token: null })
          }
        } catch (error) {
          console.error('Fetch profile error:', error)
        }
      },
    }),
    {
      name: 'yaojin-user-storage',
    }
  )
)
