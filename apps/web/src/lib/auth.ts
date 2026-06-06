import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from './api'

const COOKIE_NAME = 'sellsync:token'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export function setAuthCookie(token: string) {
  document.cookie = `${COOKIE_NAME}=${token}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
}

export function clearAuthCookie() {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`
}

interface User {
  id: string
  name: string
  email: string
}

interface Tenant {
  id: string
  name: string
  slug: string
  plan: string
  onboardingCompletedAt?: string | null
}

interface AuthState {
  token: string | null
  user: User | null
  tenant: Tenant | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<{ requires2fa?: boolean; tempToken?: string }>
  register: (tenantName: string, name: string, email: string, password: string) => Promise<void>
  logout: () => void
  hydrate: () => Promise<void>
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      tenant: null,
      isAuthenticated: false,

      login: async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password })
        if (data.requires2fa) return { requires2fa: true, tempToken: data.tempToken }
        localStorage.setItem('sellsync:token', data.token)
        setAuthCookie(data.token)
        set({ token: data.token, user: data.user, tenant: data.tenant, isAuthenticated: true })
        return {}
      },

      register: async (tenantName, name, email, password) => {
        const { data } = await api.post('/auth/register', { tenantName, name, email, password })
        localStorage.setItem('sellsync:token', data.token)
        setAuthCookie(data.token)
        set({ token: data.token, user: data.user, tenant: data.tenant, isAuthenticated: true })
      },

      logout: () => {
        localStorage.removeItem('sellsync:token')
        clearAuthCookie()
        set({ token: null, user: null, tenant: null, isAuthenticated: false })
      },

      hydrate: async () => {
        const token = get().token
        if (!token) return
        try {
          const { data } = await api.get('/auth/me')
          set({ user: data, tenant: data.tenant, isAuthenticated: true })
        } catch {
          get().logout()
        }
      },
    }),
    {
      name: 'sellsync:auth',
      partialize: (s) => ({ token: s.token, user: s.user, tenant: s.tenant }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) setAuthCookie(state.token)
      },
    },
  ),
)
