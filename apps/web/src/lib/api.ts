import axios from 'axios'

// Sempre same-origin: o Next faz proxy de /backend/* para a API real
// (ver rewrites em next.config.ts). Sem CORS, sem env var no bundle.
export const api = axios.create({ baseURL: '/backend' })

api.interceptors.request.use((config) => {
  // sessionStorage: o token morre com a sessão do navegador — login obrigatório
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('sellsync:token') : null
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      sessionStorage.removeItem('sellsync:token')
      sessionStorage.removeItem('sellsync:auth')
      // Resquícios do esquema antigo (localStorage)
      localStorage.removeItem('sellsync:token')
      localStorage.removeItem('sellsync:auth')
      document.cookie = 'sellsync:token=; path=/; max-age=0'
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  },
)
