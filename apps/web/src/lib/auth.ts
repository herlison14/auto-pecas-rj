import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { api } from './api'

const COOKIE_NAME = 'sellsync:token'

// Cookie de SESSÃO (sem max-age): morre quando o navegador fecha —
// o login com e-mail e senha é obrigatório a cada nova sessão.
export function setAuthCookie(token: string) {
  document.cookie = `${COOKIE_NAME}=${token}; path=/; SameSite=Lax`
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
        sessionStorage.setItem('sellsync:token', data.token)
        setAuthCookie(data.token)
        set({ token: data.token, user: data.user, tenant: data.tenant, isAuthenticated: true })
        return {}
      },

      register: async (tenantName, name, email, password) => {
        const { data } = await api.post('/auth/register', { tenantName, name, email, password })
        sessionStorage.setItem('sellsync:token', data.token)
        setAuthCookie(data.token)
        set({ token: data.token, user: data.user, tenant: data.tenant, isAuthenticated: true })
      },

      logout: () => {
        sessionStorage.removeItem('sellsync:token')
        // Limpa também resquícios do esquema antigo (localStorage)
        localStorage.removeItem('sellsync:token')
        localStorage.removeItem('sellsync:auth')
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
      // sessionStorage: a sessão acaba quando o navegador fecha — login obrigatório
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ token: s.token, user: s.user, tenant: s.tenant }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) setAuthCookie(state.token)
      },
    },
  ),
)
