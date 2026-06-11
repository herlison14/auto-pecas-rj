import axios from 'axios'

const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost'
const BASE_URL = process.env.NEXT_PUBLIC_API_URL
  ?? (isLocalhost ? 'http://localhost:3001' : 'https://auto-pecas-rj.onrender.com')

export const api = axios.create({ baseURL: BASE_URL })

api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('sellsync:token') : null
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('sellsync:token')
      localStorage.removeItem('sellsync:auth')
      document.cookie = 'sellsync:token=; path=/; max-age=0'
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)
